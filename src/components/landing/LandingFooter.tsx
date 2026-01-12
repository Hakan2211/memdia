'use client'

import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import MemdiaLogo from '@/components/common/MemdiaLogo'

const footerLinks = {
  product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ],
  company: [
    { label: 'About', href: 'https://hakanda.com/about' },
    { label: 'Blog', href: 'https://hakanda.com/articles' },
    { label: 'Contact', href: 'https://hakanda.com/contact' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy', isInternal: true },
    { label: 'Terms', href: '/terms', isInternal: true },
  ],
}

function FooterLinkItem({
  label,
  href,
  isInternal,
  scrollToSection,
}: {
  label: string
  href: string
  isInternal?: boolean
  scrollToSection: (href: string) => void
}) {
  const className =
    'text-slate-500 hover:text-[#7e9ec9] transition-colors text-sm text-left'

  if (href.startsWith('http')) {
    return (
      <a
        href={href}
        className={className}
        target="_blank"
        rel="noopener noreferrer"
      >
        {label}
      </a>
    )
  }

  if (isInternal) {
    return (
      <Link to={href} className={className}>
        {label}
      </Link>
    )
  }

  return (
    <button onClick={() => scrollToSection(href)} className={className}>
      {label}
    </button>
  )
}

export function LandingFooter() {
  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const id = href.slice(1)
      const element = document.getElementById(id)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="container mx-auto px-4 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="col-span-2 md:col-span-1"
          >
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] shadow-md flex items-center justify-center">
                <MemdiaLogo className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-[#5a7ba6] to-[#7e9ec9] bg-clip-text text-transparent">
                Memdia
              </span>
            </Link>
            <p className="text-slate-500 text-sm max-w-xs">
              Your AI companion for daily reflection and personal growth.
              Available in 32 languages.
            </p>
          </motion.div>

          {/* Product Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h4 className="font-semibold text-slate-900 mb-4">Product</h4>
            <ul className="space-y-3 flex flex-col items-start">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <FooterLinkItem {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Company Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 className="font-semibold text-slate-900 mb-4">Company</h4>
            <ul className="space-y-3 flex flex-col items-start">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <FooterLinkItem {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h4 className="font-semibold text-slate-900 mb-4">Legal</h4>
            <ul className="space-y-3 flex flex-col items-start">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <FooterLinkItem {...link} scrollToSection={scrollToSection} />
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Memdia. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <span className="text-sm text-slate-400">
              Built with care for your personal growth
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  )
}
