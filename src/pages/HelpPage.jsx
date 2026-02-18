import { useMemo, useState } from "react";

const TOPICS = [
  "General Question",
  "Bug Report",
  "Feature Request",
  "Account Help",
];

const HelpPage = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");

  const whatsappNumber = process.env.REACT_APP_SUPPORT_WHATSAPP_NUMBER || "";

  const composedMessage = useMemo(() => {
    const lines = [
      `Topic: ${topic}`,
      `Name: ${name || "Not provided"}`,
      `Email: ${email || "Not provided"}`,
      "",
      "Message:",
      "Hello, Youssef.",
      message || "(No message entered)",
    ];
    return lines.join("\n");
  }, [topic, name, email, message]);

  const handleSendWhatsApp = () => {
    if (!whatsappNumber) return;
    const encoded = encodeURIComponent(composedMessage);
    const url = `https://wa.me/${whatsappNumber}?text=${encoded}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white pt-24 pb-14 px-4 md:px-8">
      <div className="max-w-5xl mx-auto">
        <section className="rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">
            Support
          </p>
          <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">
            Contact Me
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/75 max-w-3xl">
            Write your question here. When you click send, we open WhatsApp with
            your drafted message pre-filled.
          </p>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-sm focus:outline-none focus:border-red-400/60"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Email
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-sm focus:outline-none focus:border-red-400/60"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Topic
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-sm focus:outline-none focus:border-red-400/60"
                >
                  {TOPICS.map((item) => (
                    <option key={item} value={item} className="text-black">
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your question or issue..."
                  rows={6}
                  className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400/60"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0f1115] overflow-hidden flex flex-col">
              <div className="h-12 px-4 border-b border-white/10 bg-[#202c33] flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-green-500/25 border border-green-400/40 text-[10px] font-bold text-green-200 flex items-center justify-center">
                  WA
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">
                    WhatsApp Preview
                  </p>
                  <p className="text-[10px] text-white/55">Support chat</p>
                </div>
              </div>

              <div className="p-3 md:p-4 min-h-[250px] bg-[#0b141a] bg-[radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.04),transparent_35%)] space-y-2.5">
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#202c33] px-3 py-2 text-xs md:text-sm text-white/85">
                  Hi! Tell me what you need help with.
                </div>

                <div className="ml-auto max-w-[90%] rounded-2xl rounded-tr-sm bg-[#005c4b] px-3 py-2 text-xs md:text-sm text-white whitespace-pre-wrap leading-relaxed">
                  {composedMessage}
                </div>
              </div>

              <div className="border-t border-white/10 p-3 bg-[#111b21]">
                <button
                  onClick={handleSendWhatsApp}
                  disabled={!whatsappNumber}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Send via WhatsApp
                </button>

                {!whatsappNumber && (
                  <p className="mt-2 text-xs text-yellow-300/90">
                    Missing `REACT_APP_SUPPORT_WHATSAPP_NUMBER` in environment
                    config.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpPage;
