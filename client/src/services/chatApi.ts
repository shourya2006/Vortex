const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001";

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  title: string;
  subjectId: string;
  messages: Message[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatPreview {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
  preview: string;
}

const getToken = () => localStorage.getItem("accessToken") || "";

export const chatApi = {
  async createChat(subjectId: string): Promise<{ success: boolean; chat?: Chat; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
      body: JSON.stringify({ subjectId }),
    });
    return response.json();
  },

  async sendMessage(
    chatId: string,
    message: string
  ): Promise<{ success: boolean; response?: string; hasContext?: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/${chatId}/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
      body: JSON.stringify({ message }),
    });
    return response.json();
  },

  async sendMessageStream(
    chatId: string,
    message: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ): Promise<void> {
    const response = await fetch(`${API_BASE}/api/chat/${chatId}/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      onError("Failed to connect to stream");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError("No response body");
      return;
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) {
              onError(data.error);
              return;
            }
            if (data.done) {
              onComplete();
              return;
            }
            if (data.content) {
              onChunk(data.content);
            }
          } catch {
             
          }
        }
      }
    }
  },

  async getChats(subjectId: string): Promise<{ success: boolean; chats?: ChatPreview[]; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/list/${subjectId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
    });
    return response.json();
  },

  async getChat(chatId: string): Promise<{ success: boolean; chat?: Chat; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
    });
    return response.json();
  },

  async renameChat(chatId: string, title: string): Promise<{ success: boolean; chat?: Chat; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/${chatId}/rename`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
      body: JSON.stringify({ title }),
    });
    return response.json();
  },

  async deleteChat(chatId: string): Promise<{ success: boolean; error?: string }> {
    const response = await fetch(`${API_BASE}/api/chat/${chatId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "auth-token": getToken(),
      },
    });
    return response.json();
  },
};
