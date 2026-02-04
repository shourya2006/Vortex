const OpenAI = require("openai");
const Chat = require("../models/Chat.model");
const { generateEmbedding } = require("./vectorService");
const { queryVectors } = require("./pineconeService");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are StudyBuddy AI, a helpful assistant for students. You answer questions based on lecture content provided as context. 

Guidelines:
- Be concise but thorough
- Use the provided lecture context to answer questions
- If the context doesn't contain relevant information, say so and provide general guidance
- Format responses with markdown when helpful (bullet points, code blocks, etc.)
- Be encouraging and supportive`;

async function createChat(userId, subjectId) {
  const chat = new Chat({
    userId,
    subjectId,
    title: "New Chat",
    messages: [],
  });
  await chat.save();
  return chat;
}

async function getRelevantContext(query, subjectId) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const matches = await queryVectors(queryEmbedding, subjectId, 5);

    if (!matches || matches.length === 0) {
      return null;
    }

    const contextChunks = matches
      .filter((m) => m.score > 0.3)
      .map((m) => {
        const title = m.metadata?.title || "Unknown Lecture";
        const text = m.metadata?.chunkText || "";
        return `[From: ${title}]\n${text}`;
      });

    if (contextChunks.length === 0) {
      return null;
    }

    return contextChunks.join("\n\n---\n\n");
  } catch (error) {
    console.error("[Chat] Error getting context:", error.message);
    return null;
  }
}

async function sendMessage(chatId, userMessage, userId) {
  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new Error("Chat not found");
  }

  if (chat.userId !== userId) {
    throw new Error("Unauthorized");
  }

  chat.messages.push({
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  });

  if (chat.messages.length === 1) {
    chat.title =
      userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
  }

  const context = await getRelevantContext(userMessage, chat.subjectId);

  const systemMessage = context
    ? `${SYSTEM_PROMPT}\n\nRelevant lecture content:\n${context}`
    : `${SYSTEM_PROMPT}\n\nNo specific lecture content found for this query. Provide general guidance.`;

  const conversationHistory = chat.messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        ...conversationHistory,
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0].message.content;

    chat.messages.push({
      role: "assistant",
      content: assistantMessage,
      timestamp: new Date(),
    });

    chat.updatedAt = new Date();
    await chat.save();

    return {
      message: assistantMessage,
      hasContext: !!context,
    };
  } catch (error) {
    console.error("[Chat] OpenAI error:", error.message);
    throw new Error("Failed to generate response");
  }
}

async function* sendMessageStream(chatId, userMessage, userId) {
  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new Error("Chat not found");
  }

  if (chat.userId !== userId) {
    throw new Error("Unauthorized");
  }

  chat.messages.push({
    role: "user",
    content: userMessage,
    timestamp: new Date(),
  });

  if (chat.messages.length === 1) {
    chat.title =
      userMessage.substring(0, 50) + (userMessage.length > 50 ? "..." : "");
  }

  await chat.save();

  const context = await getRelevantContext(userMessage, chat.subjectId);

  const systemMessage = context
    ? `${SYSTEM_PROMPT}\n\nRelevant lecture content:\n${context}`
    : `${SYSTEM_PROMPT}\n\nNo specific lecture content found for this query. Provide general guidance.`;

  const conversationHistory = chat.messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemMessage },
      ...conversationHistory,
    ],
    max_tokens: 1000,
    temperature: 0.7,
    stream: true,
  });

  let fullContent = "";

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || "";
    if (content) {
      fullContent += content;
      yield content;
    }
  }

  chat.messages.push({
    role: "assistant",
    content: fullContent,
    timestamp: new Date(),
  });

  chat.updatedAt = new Date();
  await chat.save();
}

async function getChatById(chatId, userId) {
  const chat = await Chat.findById(chatId).lean();

  if (!chat) {
    return null;
  }

  if (chat.userId !== userId) {
    throw new Error("Unauthorized");
  }

  return chat;
}

async function getUserChats(userId, subjectId) {
  const chats = await Chat.find({ userId, subjectId })
    .sort({ updatedAt: -1 })
    .select("_id title updatedAt messages")
    .lean();

  return chats.map((chat) => ({
    id: chat._id,
    title: chat.title,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages.length,
    preview: chat.messages[0]?.content.substring(0, 50) || "",
  }));
}

async function renameChat(chatId, userId, newTitle) {
  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new Error("Chat not found");
  }

  if (chat.userId !== userId) {
    throw new Error("Unauthorized");
  }

  chat.title = newTitle;
  await chat.save();
  return chat;
}

async function deleteChat(chatId, userId) {
  const chat = await Chat.findById(chatId);

  if (!chat) {
    throw new Error("Chat not found");
  }

  if (chat.userId !== userId) {
    throw new Error("Unauthorized");
  }

  await Chat.findByIdAndDelete(chatId);
  return true;
}

module.exports = {
  createChat,
  sendMessage,
  sendMessageStream,
  getChatById,
  getUserChats,
  renameChat,
  deleteChat,
  getRelevantContext,
};
