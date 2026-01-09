'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const faqs = [
  {
    question: 'How does voice recording work?',
    answer:
      'Simply tap the record button and start speaking. Our app uses advanced speech recognition to transcribe your voice in real-time. You can speak naturally - pause, think, and continue. The AI will engage with you through voice responses, making it feel like a natural conversation.',
  },
  {
    question: 'Is my data private and secure?',
    answer:
      'Absolutely. Your privacy is our top priority. All voice recordings and transcripts are encrypted end-to-end. We never share your personal data with third parties.',
  },
  {
    question: 'What languages are supported?',
    answer:
      'Memdia supports a wide range of languages including English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Japanese, Korean, Chinese (Mandarin and Cantonese), Hindi, and many more. The app automatically detects your language, allowing you to speak naturally.',
  },
  {
    question: 'Can I change the style of my memory images?',
    answer:
      'Yes! You can personalize how your memories are visualized. Choose from various artistic styles including Realistic, Dreamlike, Watercolor, Geometric, and Sketch to match your preference or mood.',
  },
  {
    question: 'How does the AI generate images for my day?',
    answer:
      'After your 3-minute voice session, our AI analyzes the themes, emotions, and key moments you described. It then creates a unique, artistic image that captures the essence of your day. These images serve as visual memories that complement your voice recordings.',
  },
  {
    question: "What's the difference between voice sessions and reflections?",
    answer:
      'Voice sessions (3 minutes) are quick daily check-ins where you share what happened in your day and receive an AI-generated image. Reflection sessions (10 minutes, Pro only) are deeper, therapeutic conversations where the AI asks thoughtful questions to help you process emotions, explore thoughts, and gain insights.',
  },
]

function FAQItem({
  faq,
  isOpen,
  onToggle,
  index,
}: {
  faq: (typeof faqs)[0]
  isOpen: boolean
  onToggle: () => void
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="mb-4"
    >
      <div
        className={cn(
          'rounded-2xl border transition-all duration-300 overflow-hidden',
          isOpen
            ? 'border-[#7e9ec9]/40 bg-white shadow-lg shadow-[#7e9ec9]/5'
            : 'border-slate-200 bg-white/50 hover:bg-white hover:shadow-md',
        )}
      >
        <button
          onClick={onToggle}
          className="w-full px-6 py-5 flex items-center justify-between text-left group"
          aria-expanded={isOpen}
        >
          <span
            className={cn(
              'font-medium transition-colors pr-4 text-lg',
              isOpen
                ? 'text-[#5a7ba6]'
                : 'text-slate-900 group-hover:text-[#5a7ba6]',
            )}
          >
            {faq.question}
          </span>
          <div
            className={cn(
              'flex-shrink-0 rounded-full p-1 transition-colors duration-300',
              isOpen
                ? 'bg-[#7e9ec9]/10 text-[#5a7ba6]'
                : 'bg-slate-100 text-slate-400 group-hover:bg-[#7e9ec9]/10 group-hover:text-[#5a7ba6]',
            )}
          >
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-5 w-5" />
            </motion.div>
          </div>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <div className="px-6 pb-6 pt-0">
                <p className="text-slate-600 leading-relaxed text-base">
                  {faq.answer}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="py-24 lg:py-32 bg-white relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-40">
        <div className="absolute top-[10%] right-[-5%] w-[600px] h-[600px] bg-slate-50 rounded-full blur-[80px]" />
        <div className="absolute bottom-[20%] left-[-10%] w-[500px] h-[500px] bg-blue-50/50 rounded-full blur-[80px]" />
      </div>

      <div className="container relative mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Everything you need to know about Memdia.
          </p>
        </motion.div>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto">
          {faqs.map((faq, index) => (
            <FAQItem
              key={index}
              faq={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
