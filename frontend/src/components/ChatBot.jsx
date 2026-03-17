import React, { useState, useRef, useEffect } from 'react'

const WA_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current flex-shrink-0">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const SYSTEM_PROMPT = `You are Aria, a warm and expert study abroad counsellor at AIEC (Aradhya International Education Consultancy).

Your goal is to help students find the best country and course to study abroad.

Conversation flow:
1. Greet warmly and ask for their qualification
2. Ask for their marks/percentage
3. Ask for English test score (IELTS/TOEFL/PTE) — if none, that's okay
4. Ask what field/course they want to study
5. Ask their annual budget (in USD or INR)
6. Ask if they want PR/immigration pathway after studies
7. Give a specific recommendation: best country, course name, 2-3 universities, estimated cost
8. Offer free consultation — ask for name, email, phone number
9. Confirm and close warmly

Rules:
- Be conversational, friendly, encouraging — like a real counsellor
- Ask ONE question at a time
- Keep replies to 2-3 sentences max
- When recommending, be specific and confident
- Only discuss study abroad topics
- After collecting name/email/phone, say a counsellor will call within 24 hours`

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm Aria, your personal study abroad counsellor at AIEC 👋\n\nI'm here to help you find the perfect country and course based on your profile. Let's start — what's your highest qualification? (e.g. 12th grade, Bachelor's, Master's)",
}

/* ── Rule-based fallback (no API key) ─────────────────────────────── */
function ruleBasedReply(messages) {
  const userMsgs = messages.filter(m => m.role === 'user')
  const count = userMsgs.length
  const last = userMsgs[count - 1]?.content || ''

  const flow = [
    "That's great! What percentage or GPA did you score in your last qualification?",
    "Got it! Do you have an English test score like IELTS, TOEFL, or PTE? If not, just say 'not yet' — that's completely fine! 😊",
    "Perfect! What field or course are you interested in studying? (e.g. Computer Science, MBA, Engineering, Nursing, Law...)",
    "Great choice! What's your approximate annual budget for tuition and living expenses? You can mention it in USD or INR.",
    "Almost done! Are you interested in Permanent Residency (PR) or immigration pathway after your studies? And when are you planning to start?",
  ]

  if (count <= flow.length) {
    return flow[count - 1] || flow[flow.length - 1]
  }

  // Simple recommendation
  const allText = userMsgs.map(m => m.content.toLowerCase()).join(' ')
  let country = 'Canada', unis = 'University of Toronto, UBC, McMaster'
  if (allText.includes('germany') || allText.includes('low budget') || allText.includes('free')) {
    country = 'Germany'; unis = 'TU Munich, RWTH Aachen, Heidelberg University'
  } else if (allText.includes('australia')) {
    country = 'Australia'; unis = 'University of Melbourne, Monash, UNSW'
  } else if (allText.includes('uk') || allText.includes('united kingdom')) {
    country = 'UK'; unis = 'University of Manchester, Edinburgh, Warwick'
  }

  if (count === flow.length + 1) {
    return `Based on your profile, I recommend **${country}** — it's a great fit for your budget, goals, and career plans! 🎉\n\nTop universities: ${unis}.\n\nWould you like a free consultation with our expert counsellors to plan your application?`
  }
  if (count === flow.length + 2) return "Wonderful! Could I get your full name to book the consultation?"
  if (count === flow.length + 3) return `Nice to meet you, ${last}! What's your email address?`
  if (count === flow.length + 4) return "And your WhatsApp number?"
  return "You're all set! 🎊 Our counsellor will reach out within 24 hours. Feel free to also take our full AI assessment on the website for a detailed report!"
}

/* ── OpenAI direct call ────────────────────────────────────────────── */
async function getAIReply(messages) {
  const apiKey = import.meta.env.VITE_OPENAI_KEY
  if (!apiKey) return ruleBasedReply(messages)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.8,
      max_tokens: 250,
    }),
  })

  if (!res.ok) return ruleBasedReply(messages)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ruleBasedReply(messages)
}

/* ── Save lead to backend (best-effort) ───────────────────────────── */
async function trySaveLead(messages) {
  try {
    const userMsgs = messages.filter(m => m.role === 'user').map(m => m.content)
    // Heuristic: last 3 user messages likely contain name, email, phone
    const recent = userMsgs.slice(-3)
    const email = recent.find(m => m.includes('@'))
    const phone = recent.find(m => /\d{8,}/.test(m.replace(/\s/g, '')))
    const name  = recent.find(m => !m.includes('@') && !/\d{8,}/.test(m.replace(/\s/g, '')))
    if (!email) return
    const api = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
    await fetch(`${api}/capture-lead/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name || '', email, phone: phone || '', source: 'chatbot' }),
    })
  } catch { /* silent */ }
}

/* ── UI Components ─────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-3">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
      <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isBot = msg.role === 'assistant'
  const formatted = msg.content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>')
  return (
    <div className={`flex items-end gap-2 mb-3 ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
      )}
      <div
        className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
          isBot
            ? 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
            : 'bg-primary-600 text-white rounded-br-sm'
        }`}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    </div>
  )
}

/* ── Main ChatBot ──────────────────────────────────────────────────── */
export default function ChatBot() {
  const [open, setOpen]       = useState(false)
  const [messages, setMessages] = useState([INITIAL_MESSAGE])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [unread, setUnread]   = useState(1)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => inputRef.current?.focus(), 100) }
  }, [open])

  const sendMessage = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || loading || done) return

    const userMsg = { role: 'user', content: trimmed }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setLoading(true)

    try {
      // Pass full history (excluding initial greeting) to OpenAI
      const history = updated.slice(1)
      const reply = await getAIReply(history)
      const botMsg = { role: 'assistant', content: reply }
      const final = [...updated, botMsg]
      setMessages(final)

      // Detect if conversation is wrapping up
      const replyLower = reply.toLowerCase()
      if (replyLower.includes('24 hours') || replyLower.includes('reach out') || replyLower.includes('all set')) {
        setDone(true)
        trySaveLead(final)
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: ruleBasedReply([...messages, userMsg].filter(m => m.role === 'user').length > 0
          ? [...messages, userMsg]
          : messages)
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  const wa = import.meta.env.VITE_WHATSAPP || '918733903147'
  const waLink = `https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to know more about studying abroad.')}`

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 flex flex-col bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-fade-in" style={{ maxHeight: '580px' }}>

          {/* Header */}
          <div className="bg-gradient-to-r from-primary-700 to-primary-900 px-5 py-4 flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">A</div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-800" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-sm">Aria</p>
              <p className="text-blue-200 text-xs">AI Study Abroad Counsellor · Online</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50" style={{ minHeight: 0 }}>
            {messages.map((msg, i) => <Message key={i} msg={msg} />)}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Done CTA */}
          {done && (
            <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-3 flex-shrink-0">
              <span className="text-xl">🎉</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-green-800">Consultation booked!</p>
                <p className="text-xs text-green-600">We'll reach out within 24 hours.</p>
              </div>
              <a href={waLink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                {WA_ICON} WhatsApp
              </a>
            </div>
          )}

          {/* Input */}
          {!done && (
            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Type a message..."
                className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 max-h-24"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="w-9 h-9 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          )}

          <div className="px-4 py-2 bg-white border-t border-gray-50 flex items-center justify-between flex-shrink-0">
            <span className="text-xs text-gray-400">Powered by AIEC AI</span>
            <a href={waLink} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
              {WA_ICON} Switch to WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Bubble */}
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 left-6 z-50 flex items-center gap-3 bg-gradient-to-r from-primary-600 to-primary-800 hover:from-primary-700 hover:to-primary-900 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 pl-4 pr-5 py-3"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm">A</div>
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-primary-700" />
        </div>
        <div className="text-left">
          <p className="text-xs font-bold leading-tight">Chat with Aria</p>
          <p className="text-xs text-blue-200 leading-tight">AI Study Counsellor</p>
        </div>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{unread}</span>
        )}
      </button>
    </>
  )
}
