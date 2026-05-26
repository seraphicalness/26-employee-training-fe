import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  CirclePlus,
  MessageCircle,
  Plus,
  SendHorizontal,
  Settings,
  User,
  UserRound
} from "lucide-react";
import "./styles.css";
import { useEffect, useMemo, useRef, useState } from "react";

type Topic = {
  id: string;
  title: string;
  subtitle: string;
  avatar: string;
  unread?: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ApiUser = {
  name?: string;
  email?: string;
  department?: string;
  position?: string;
};

const fallbackTopics: Topic[] = [
  {
    id: "email",
    title: "신입사원 교육 [메일쓰기]",
    subtitle: "안녕하세요.",
    avatar: "/avatars/email.png",
    unread: 1
  },
  {
    id: "communication",
    title: "신입사원 교육 [커뮤니케이션]",
    subtitle: "탭하여 대화를 시작하세요.",
    avatar: "/avatars/manager.png"
  },
  {
    id: "organization",
    title: "신입사원 교육 [조직 적응]",
    subtitle: "탭하여 대화를 시작하세요.",
    avatar: "/avatars/organization.png"
  },
  {
    id: "attitude",
    title: "신입사원 교육 [협업/태도]",
    subtitle: "탭하여 대화를 시작하세요.",
    avatar: "/avatars/email.png"
  }
];

const starterMessages: Record<string, ChatMessage[]> = {
  communication: [
    {
      id: "starter-1",
      role: "user",
      content: "오늘 일정은 거의 마무리된 것 같습니다. 저 퇴근해도 되나요?"
    },
    {
      id: "starter-2",
      role: "assistant",
      content: "벌써요? 아직 할 거 많지 않나요? 이거 한 번만 더 봐주세요."
    },
    {
      id: "starter-3",
      role: "user",
      content:
        "부장님, 오늘 작업은 마무리했고 내일 일정 준비도 해둔 상태입니다. 혹시 추가로 필요한 부분 있을까요?"
    },
    {
      id: "starter-4",
      role: "assistant",
      content: "음... 오늘은 여기까지 해도 되겠네요. 수고했어요."
    }
  ]
};

const emptyProfile: ApiUser = {
  name: "신입사원",
  email: "",
  department: "교육팀",
  position: "사원"
};

function normalizeTopic(raw: unknown, index: number): Topic | null {
  if (typeof raw === "string") {
    return {
      ...fallbackTopics[index % fallbackTopics.length],
      id: raw,
      title: formatTopicTitle(raw)
    };
  }

  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = String(record.id ?? record.topic_id ?? record.key ?? `topic-${index}`);
  const title = formatTopicTitle(
    String(record.title ?? record.name ?? record.topic ?? fallbackTopics[index % fallbackTopics.length].title)
  );
  const subtitle = String(
    record.subtitle ??
      record.last_message ??
      record.description ??
      fallbackTopics[index % fallbackTopics.length].subtitle
  );
  const unreadValue = Number(record.unread ?? record.unread_count ?? 0);

  return {
    id,
    title,
    subtitle,
    unread: unreadValue > 0 ? unreadValue : undefined,
    avatar: fallbackTopics[index % fallbackTopics.length].avatar
  };
}

function formatTopicTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("신입사원 교육")) return trimmed;

  return `신입사원 교육 [${trimmed === "메일 쓰기" ? "메일쓰기" : trimmed}]`;
}

function extractArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidates = [record.topics, record.data, record.items, record.results];
  return candidates.find(Array.isArray) ?? [];
}

function extractText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const value =
    record.reply ??
    record.answer ??
    record.message ??
    record.content ??
    record.text ??
    record.response ??
    record.result;
  return typeof value === "string" ? value : "";
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody = init?.body !== undefined;
  const isForm = init?.body instanceof FormData;

  if (hasBody && !isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function App() {
  const [view, setView] = useState<"chatList" | "chat" | "profile" | "settings">("chatList");
  const [topics, setTopics] = useState<Topic[]>(fallbackTopics);
  const [selectedTopicId, setSelectedTopicId] = useState("communication");
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, ChatMessage[]>>(starterMessages);
  const [isSending, setIsSending] = useState(false);
  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0] ?? fallbackTopics[0],
    [selectedTopicId, topics]
  );

  useEffect(() => {
    let cancelled = false;

    requestJson<unknown>("/api/chat/topics")
      .then((payload) => {
        if (cancelled) return;
        const parsed = extractArray(payload)
          .map(normalizeTopic)
          .filter((topic): topic is Topic => topic !== null);
        if (parsed.length) {
          setTopics(parsed);
          setSelectedTopicId((current) => parsed.find((topic) => topic.id === current)?.id ?? parsed[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setTopics(fallbackTopics);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openTopic = (topic: Topic) => {
    setSelectedTopicId(topic.id);
    setMessagesByTopic((current) => ({
      ...current,
      [topic.id]:
        current[topic.id] ??
        starterMessages[topic.id] ??
        (topic.title.includes("커뮤니케이션") ? starterMessages.communication : [])
    }));
    setView("chat");
  };

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed
    };

    setMessagesByTopic((current) => ({
      ...current,
      [selectedTopic.id]: [...(current[selectedTopic.id] ?? []), userMessage]
    }));
    setIsSending(true);

    try {
      const payload = await requestJson<unknown>("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({
          topicId: selectedTopic.id,
          topic: selectedTopic.title,
          message: trimmed
        })
      });
      const reply = extractText(payload) || "확인했습니다. 이어서 이야기해볼까요?";

      setMessagesByTopic((current) => ({
        ...current,
        [selectedTopic.id]: [
          ...(current[selectedTopic.id] ?? []),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: reply
          }
        ]
      }));
    } catch {
      setMessagesByTopic((current) => ({
        ...current,
        [selectedTopic.id]: [
          ...(current[selectedTopic.id] ?? []),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "서버 연결을 확인하지 못했어요. 백엔드가 켜지면 다시 전송해주세요."
          }
        ]
      }));
    } finally {
      setIsSending(false);
    }
  };

  const uploadFile = async (file: File) => {
    const fileMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: `첨부 파일: ${file.name}`
    };

    setMessagesByTopic((current) => ({
      ...current,
      [selectedTopic.id]: [...(current[selectedTopic.id] ?? []), fileMessage]
    }));

    const form = new FormData();
    form.append("file", file);
    form.append("topicId", selectedTopic.id);
    form.append("topic", selectedTopic.title);
    setIsSending(true);

    try {
      const payload = await requestJson<unknown>("/api/chat/upload", {
        method: "POST",
        body: form
      });
      const reply = extractText(payload) || "파일을 받았습니다.";
      setMessagesByTopic((current) => ({
        ...current,
        [selectedTopic.id]: [
          ...(current[selectedTopic.id] ?? []),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: reply
          }
        ]
      }));
    } catch {
      setMessagesByTopic((current) => ({
        ...current,
        [selectedTopic.id]: [
          ...(current[selectedTopic.id] ?? []),
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: "파일 업로드에 실패했습니다. 서버 상태를 확인해주세요."
          }
        ]
      }));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="phone-shell">
      {view === "chatList" && <ChatList topics={topics} onOpenTopic={openTopic} onCreate={() => setView("chat")} />}
      {view === "chat" && (
        <ChatRoom
          topic={selectedTopic}
          messages={messagesByTopic[selectedTopic.id] ?? []}
          isSending={isSending}
          onBack={() => setView("chatList")}
          onSend={sendMessage}
          onUpload={uploadFile}
        />
      )}
      {view === "profile" && <ProfilePanel />}
      {view === "settings" && <SettingsPanel />}
      {view !== "chat" && <BottomNav current={view} onNavigate={setView} />}
    </main>
  );
}

function ChatList({
  topics,
  onOpenTopic,
  onCreate
}: {
  topics: Topic[];
  onOpenTopic: (topic: Topic) => void;
  onCreate: () => void;
}) {
  return (
    <section className="page with-bottom-nav chat-list-page">
      <header className="page-header">
        <h1>대화</h1>
      </header>
      <div className="topic-list">
        {topics.map((topic) => (
          <button className="topic-row" key={topic.id} type="button" onClick={() => onOpenTopic(topic)}>
            <img className="topic-avatar" src={topic.avatar} alt="" />
            <span className="topic-copy">
              <strong>{topic.title}</strong>
              <span>{topic.subtitle}</span>
            </span>
            {topic.unread ? <span className="unread-badge">{topic.unread}</span> : null}
          </button>
        ))}
      </div>
      <button className="floating-add" type="button" onClick={onCreate} aria-label="새 대화">
        <CirclePlus size={39} strokeWidth={2.8} />
      </button>
    </section>
  );
}

function ChatRoom({
  topic,
  messages,
  isSending,
  onBack,
  onSend,
  onUpload
}: {
  topic: Topic;
  messages: ChatMessage[];
  isSending: boolean;
  onBack: () => void;
  onSend: (content: string) => void;
  onUpload: (file: File) => void;
}) {
  const [draft, setDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isSending]);

  const submit = () => {
    const value = draft;
    setDraft("");
    onSend(value);
  };

  return (
    <section className="chat-room">
      <header className="chat-header">
        <button className="icon-button back-button" type="button" onClick={onBack} aria-label="뒤로">
          <ArrowLeft size={26} strokeWidth={3} />
        </button>
        <h1>{topic.title}</h1>
      </header>

      <div className="message-scroll">
        {messages.length === 0 ? (
          <div className="empty-chat">메시지를 보내 대화를 시작하세요.</div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        {isSending ? (
          <div className="typing-row">
            <img className="chat-avatar" src="/avatars/manager.png" alt="" />
            <div className="typing-bubble">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onUpload(file);
          }}
        />
        <button
          className="composer-tool"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="파일 첨부"
        >
          <Plus size={22} strokeWidth={3.3} />
        </button>
        <input
          className="composer-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="메시지"
        />
        <button className="send-button" type="submit" aria-label="전송" disabled={!draft.trim() || isSending}>
          <SendHorizontal size={17} fill="currentColor" strokeWidth={3} />
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`message-row ${isUser ? "from-user" : "from-assistant"}`}>
      {isUser ? <img className="chat-avatar" src="/avatars/employee.png" alt="" /> : null}
      {!isUser ? <img className="chat-avatar" src="/avatars/manager.png" alt="" /> : null}
      <p className="message-bubble">{message.content}</p>
    </div>
  );
}

function ProfilePanel() {
  const [profile, setProfile] = useState<ApiUser>(emptyProfile);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    requestJson<ApiUser>("/api/user/me")
      .then((data) => {
        if (!cancelled) setProfile({ ...emptyProfile, ...data });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const updateField = (field: keyof ApiUser, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }));
  };

  const save = async () => {
    setStatus("저장 중...");
    try {
      await requestJson("/api/user/me", {
        method: "PUT",
        body: JSON.stringify(profile)
      });
      setStatus("저장되었습니다.");
    } catch {
      setStatus("저장하지 못했습니다.");
    }
  };

  return (
    <section className="page with-bottom-nav form-page">
      <header className="page-header">
        <h1>내 정보</h1>
      </header>
      <div className="form-stack">
        <LabeledInput label="이름" value={profile.name ?? ""} onChange={(value) => updateField("name", value)} />
        <LabeledInput label="이메일" value={profile.email ?? ""} onChange={(value) => updateField("email", value)} />
        <LabeledInput
          label="부서"
          value={profile.department ?? ""}
          onChange={(value) => updateField("department", value)}
        />
        <LabeledInput label="직급" value={profile.position ?? ""} onChange={(value) => updateField("position", value)} />
        <button className="primary-action" type="button" onClick={save}>
          저장
        </button>
        {status ? <p className="status-text">{status}</p> : null}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    requestJson<unknown>("/api/settings/prompt")
      .then((data) => {
        if (cancelled) return;
        const text = extractText(data);
        if (text) setPrompt(text);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setStatus("저장 중...");
    try {
      await requestJson("/api/settings/prompt", {
        method: "PUT",
        body: JSON.stringify({ prompt })
      });
      setStatus("저장되었습니다.");
    } catch {
      setStatus("저장하지 못했습니다.");
    }
  };

  return (
    <section className="page with-bottom-nav form-page">
      <header className="page-header">
        <h1>설정</h1>
      </header>
      <div className="form-stack">
        <label className="field-label" htmlFor="system-prompt">
          프롬프트
        </label>
        <textarea
          id="system-prompt"
          className="prompt-box"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <button className="primary-action" type="button" onClick={save}>
          저장
        </button>
        {status ? <p className="status-text">{status}</p> : null}
      </div>
    </section>
  );
}

function LabeledInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function BottomNav({
  current,
  onNavigate
}: {
  current: "chatList" | "chat" | "profile" | "settings";
  onNavigate: (view: "chatList" | "profile" | "settings") => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      <button
        className={current === "chatList" ? "active" : ""}
        type="button"
        onClick={() => onNavigate("chatList")}
        aria-label="대화"
      >
        <MessageCircle size={27} fill={current === "chatList" ? "currentColor" : "none"} />
      </button>
      <button
        className={current === "profile" ? "active" : ""}
        type="button"
        onClick={() => onNavigate("profile")}
        aria-label="내 정보"
      >
        <UserRound size={26} fill={current === "profile" ? "currentColor" : "none"} />
      </button>
      <button
        className={current === "settings" ? "active" : ""}
        type="button"
        onClick={() => onNavigate("settings")}
        aria-label="설정"
      >
        <Settings size={27} fill={current === "settings" ? "currentColor" : "none"} />
      </button>
    </nav>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
