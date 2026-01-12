import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/landing/LandingFooter'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})

function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Back Button */}
      <div className="fixed top-4 left-4 md:top-8 md:left-8 z-50">
        <Link to="/">
          <Button
            variant="outline"
            className="gap-2 bg-white/80 backdrop-blur-sm border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 lg:px-8 pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 mb-4">
              Terms of Service
            </h1>
            <p className="text-slate-500">Last updated: January 12, 2026</p>
          </div>

          {/* Legal Content */}
          <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-p:text-slate-600 prose-li:text-slate-600 prose-a:text-[#5a7ba6] hover:prose-a:text-[#7e9ec9] prose-strong:text-slate-700">
            {/* 1. Acceptance of Terms */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                1. Acceptance of Terms
              </h2>
              <p>
                Welcome to Memdia. These Terms of Service ("Terms") constitute a
                legally binding agreement between you ("you" or "User") and
                Memdia, operated by Hakan Bilgic ("we," "us," "our," or
                "Memdia"), governing your access to and use of the Memdia voice
                AI companion application, website, and all related services
                (collectively, the "Service").
              </p>
              <p>
                BY ACCESSING OR USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE
                READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS. IF YOU
                DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE
                SERVICE.
              </p>
              <p>
                We reserve the right to modify these Terms at any time. Material
                changes will be communicated to you via email or through the
                Service at least 30 days before they take effect. Your continued
                use of the Service after such modifications constitutes your
                acceptance of the updated Terms.
              </p>
            </section>

            {/* 2. Eligibility */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                2. Eligibility
              </h2>
              <p>To use the Service, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Be at least 16 years of age.</strong> The Service is
                  not intended for individuals under 16 years old. By using the
                  Service, you represent and warrant that you are at least 16
                  years of age.
                </li>
                <li>
                  Have the legal capacity to enter into a binding contract in
                  your jurisdiction.
                </li>
                <li>
                  Not be prohibited from using the Service under any applicable
                  laws or regulations.
                </li>
                <li>
                  Not have been previously suspended or removed from the Service
                  for violation of these Terms.
                </li>
              </ul>
              <p className="mt-4">
                If you are using the Service on behalf of an organization, you
                represent and warrant that you have the authority to bind that
                organization to these Terms.
              </p>
            </section>

            {/* 3. Description of Service */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                3. Description of Service
              </h2>
              <p>
                Memdia is a voice AI daily companion application designed to
                support personal reflection and growth. The Service includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Voice Sessions:</strong> Short daily voice check-ins
                  with AI-generated responses, summaries, and images.
                </li>
                <li>
                  <strong>Reflection Sessions:</strong> Longer therapeutic-style
                  conversations that extract moods, topics, and insights.
                </li>
                <li>
                  <strong>Insights Dashboard:</strong> Visualization of your
                  mood patterns, topics discussed, and AI-generated insights
                  over time.
                </li>
                <li>
                  <strong>Multi-language Support:</strong> The Service is
                  available in 32 languages.
                </li>
                <li>
                  <strong>Personal Memory:</strong> The AI remembers context
                  from previous conversations to provide personalized responses.
                </li>
              </ul>
              <p className="mt-4">
                Features may vary based on your subscription plan and may be
                modified, updated, or discontinued at our discretion.
              </p>
            </section>

            {/* 4. Account Registration and Security */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                4. Account Registration and Security
              </h2>
              <p>
                To access the Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Provide accurate, current, and complete information during
                  registration.
                </li>
                <li>
                  Maintain and promptly update your account information to keep
                  it accurate.
                </li>
                <li>Keep your login credentials secure and confidential.</li>
                <li>
                  Immediately notify us of any unauthorized access to or use of
                  your account.
                </li>
                <li>
                  Maintain only one account per person. Multiple accounts per
                  individual are prohibited.
                </li>
              </ul>
              <p className="mt-4">
                You are solely responsible for all activities that occur under
                your account. We are not liable for any loss or damage arising
                from your failure to protect your account credentials.
              </p>
            </section>

            {/* 5. Subscription and Payments */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                5. Subscription and Payments
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.1 Subscription Plans
              </h3>
              <p>
                The Service may offer free and paid subscription tiers with
                different features and usage limits. Current pricing and
                features are displayed on our website and within the Service.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.2 Payment Processing
              </h3>
              <p>
                All payments are processed through Stripe, our third-party
                payment processor. By subscribing to a paid plan, you authorize
                us to charge your payment method for the applicable fees. You
                agree to provide accurate and complete billing information and
                to update it as necessary.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.3 Automatic Renewal
              </h3>
              <p>
                Paid subscriptions automatically renew at the end of each
                billing period (monthly or annually) unless you cancel before
                the renewal date. You will be charged the then-current
                subscription fee upon renewal.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.4 Cancellation
              </h3>
              <p>
                You may cancel your subscription at any time through your
                account settings. Cancellation will take effect at the end of
                your current billing period. You will retain access to paid
                features until the end of the period for which you have paid.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.5 No Refunds
              </h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-700 font-medium">
                  ALL FEES ARE NON-REFUNDABLE. We do not provide refunds or
                  credits for any partial subscription periods, unused features,
                  or dissatisfaction with the Service. By subscribing, you
                  acknowledge and accept this no-refund policy.
                </p>
              </div>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.6 Price Changes
              </h3>
              <p>
                We reserve the right to modify subscription prices at any time.
                Price changes will be communicated to existing subscribers at
                least 30 days in advance and will apply at the next billing
                cycle.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                5.7 Taxes
              </h3>
              <p>
                Subscription fees are exclusive of applicable taxes (including
                VAT). You are responsible for paying any taxes associated with
                your use of the Service.
              </p>
            </section>

            {/* 6. User Content and Voice Data */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                6. User Content and Voice Data
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                6.1 Your Ownership
              </h3>
              <p>
                You retain all ownership rights in the content you create,
                upload, or share through the Service, including your voice
                recordings, transcripts, and any personal information you
                provide ("User Content").
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                6.2 License to Memdia
              </h3>
              <p>
                By using the Service, you grant Memdia a non-exclusive,
                worldwide, royalty-free, sublicensable license to use, process,
                store, and analyze your User Content solely for the purposes of:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Providing and operating the Service</li>
                <li>Generating AI responses, summaries, and insights</li>
                <li>Improving and developing the Service</li>
                <li>
                  Creating anonymized, aggregated analytics (which cannot
                  identify you)
                </li>
              </ul>
              <p className="mt-4">
                This license terminates when you delete your User Content or
                your account, except for anonymized data that cannot be traced
                back to you.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                6.3 No Sale of Personal Data
              </h3>
              <p>
                We do not sell your personal data or User Content to third
                parties. Your voice recordings and personal reflections are
                processed solely to provide the Service to you.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                6.4 User Content Responsibility
              </h3>
              <p>
                You are solely responsible for your User Content. You represent
                and warrant that:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  You have all necessary rights to share your User Content
                </li>
                <li>
                  Your User Content does not violate any laws or third-party
                  rights
                </li>
                <li>
                  Your User Content does not contain malicious code or harmful
                  material
                </li>
              </ul>
            </section>

            {/* 7. Acceptable Use Policy */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                7. Acceptable Use Policy
              </h2>
              <p>
                You agree to use the Service only for lawful purposes and in
                accordance with these Terms. You must NOT:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Illegal Activities:</strong> Use the Service for any
                  illegal purpose or in violation of any applicable laws or
                  regulations.
                </li>
                <li>
                  <strong>Harmful Content:</strong> Submit content that is
                  defamatory, obscene, threatening, harassing, hateful, or
                  promotes violence or discrimination.
                </li>
                <li>
                  <strong>AI Manipulation:</strong> Attempt to manipulate,
                  "jailbreak," or circumvent the AI's safety measures to
                  generate harmful, illegal, or inappropriate content.
                </li>
                <li>
                  <strong>Impersonation:</strong> Impersonate any person or
                  entity, or falsely represent your affiliation with any person
                  or entity.
                </li>
                <li>
                  <strong>Security Violations:</strong> Attempt to gain
                  unauthorized access to the Service, other user accounts, or
                  any systems or networks connected to the Service.
                </li>
                <li>
                  <strong>Reverse Engineering:</strong> Reverse engineer,
                  decompile, disassemble, or attempt to derive the source code
                  or underlying algorithms of the Service.
                </li>
                <li>
                  <strong>Automated Access:</strong> Use bots, scrapers, or
                  automated methods to access, collect data from, or interact
                  with the Service without our written permission.
                </li>
                <li>
                  <strong>Service Abuse:</strong> Interfere with or disrupt the
                  Service, servers, or networks, or place an unreasonable load
                  on our infrastructure.
                </li>
                <li>
                  <strong>Circumvention:</strong> Circumvent, disable, or
                  interfere with security features or usage limits of the
                  Service.
                </li>
                <li>
                  <strong>Commercial Use:</strong> Use the Service for
                  commercial purposes not expressly permitted, including
                  reselling access or AI outputs.
                </li>
              </ul>
              <p className="mt-4">
                Violation of this Acceptable Use Policy may result in immediate
                suspension or termination of your account without notice or
                refund.
              </p>
            </section>

            {/* 8. AI-Generated Content Disclaimer */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                8. AI-Generated Content Disclaimer
              </h2>
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
                <p className="text-amber-800 font-medium">
                  IMPORTANT: Please read this section carefully.
                </p>
              </div>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                8.1 Not Professional Advice
              </h3>
              <p>
                THE SERVICE IS NOT A SUBSTITUTE FOR PROFESSIONAL MEDICAL,
                PSYCHOLOGICAL, PSYCHIATRIC, THERAPEUTIC, OR COUNSELING ADVICE,
                DIAGNOSIS, OR TREATMENT. The AI companion is designed for
                personal reflection and general wellbeing support only.
              </p>
              <p className="mt-4">
                If you are experiencing a mental health crisis, thoughts of
                self-harm or suicide, or any medical emergency, please contact
                emergency services, a mental health crisis line, or a qualified
                healthcare professional immediately.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                8.2 Accuracy Limitations
              </h3>
              <p>
                AI-generated responses, insights, mood analyses, and other
                outputs may be:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Inaccurate, incomplete, or misleading</li>
                <li>Based on misinterpretation of your input</li>
                <li>Outdated or not applicable to your specific situation</li>
                <li>Biased or limited by the AI model's training data</li>
              </ul>
              <p className="mt-4">
                You should independently verify any information or suggestions
                provided by the AI before relying on them for important
                decisions.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                8.3 No Guarantees
              </h3>
              <p>We do not guarantee that the Service will:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Improve your mental health or wellbeing</li>
                <li>
                  Provide accurate mood tracking or psychological insights
                </li>
                <li>Meet your specific personal growth objectives</li>
                <li>Be suitable for your particular circumstances</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                8.4 Your Responsibility
              </h3>
              <p>
                You acknowledge that your use of AI-generated content is at your
                own risk. You are solely responsible for how you interpret and
                act upon any information, suggestions, or insights provided by
                the Service.
              </p>
            </section>

            {/* 9. Intellectual Property */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                9. Intellectual Property
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                9.1 Memdia's Ownership
              </h3>
              <p>
                The Service, including all software, algorithms, AI models, user
                interface designs, graphics, logos, trademarks, and
                documentation, is owned by Memdia and protected by intellectual
                property laws. Except for the limited rights expressly granted
                herein, all rights are reserved.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                9.2 Limited License to You
              </h3>
              <p>
                Subject to these Terms, we grant you a limited, non-exclusive,
                non-transferable, revocable license to access and use the
                Service for your personal, non-commercial use only.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                9.3 Feedback
              </h3>
              <p>
                If you provide us with feedback, suggestions, or ideas about the
                Service, you grant us a perpetual, irrevocable, worldwide,
                royalty-free license to use such feedback for any purpose
                without compensation to you.
              </p>
            </section>

            {/* 10. Service Availability */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                10. Service Availability
              </h2>
              <p>
                We strive to provide reliable access to the Service but do not
                guarantee uninterrupted or error-free operation. The Service may
                be unavailable due to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Scheduled maintenance (we will endeavor to provide advance
                  notice)
                </li>
                <li>Unscheduled downtime due to technical issues</li>
                <li>Third-party service provider outages</li>
                <li>Factors beyond our reasonable control</li>
              </ul>
              <p className="mt-4">
                We reserve the right to modify, suspend, or discontinue any part
                of the Service at any time, with or without notice. We are not
                liable for any modification, suspension, or discontinuation of
                the Service.
              </p>
            </section>

            {/* 11. Limitation of Liability */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                11. Limitation of Liability
              </h2>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4">
                <p className="text-slate-700 font-medium uppercase">
                  Please read this section carefully as it limits our liability
                  to you.
                </p>
              </div>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                11.1 Disclaimer of Warranties
              </h3>
              <p>
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
                WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT
                NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS
                FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
              </p>
              <p className="mt-4">
                WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
                ERROR-FREE, SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL
                COMPONENTS. WE DO NOT WARRANT THE ACCURACY, COMPLETENESS, OR
                USEFULNESS OF ANY AI-GENERATED CONTENT.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                11.2 Limitation of Damages
              </h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
                SHALL MEMDIA, ITS OPERATOR, AFFILIATES, OR SERVICE PROVIDERS BE
                LIABLE FOR:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Any indirect, incidental, special, consequential, or punitive
                  damages
                </li>
                <li>
                  Loss of profits, revenue, data, or business opportunities
                </li>
                <li>
                  Damages arising from your reliance on AI-generated content
                </li>
                <li>
                  Damages arising from unauthorized access to or alteration of
                  your data
                </li>
                <li>
                  Any other damages arising out of or related to your use of the
                  Service
                </li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                11.3 Maximum Liability
              </h3>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL CUMULATIVE
                LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE
                TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF: (A) THE
                TOTAL AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS PRECEDING
                THE CLAIM, OR (B) ONE HUNDRED EUROS (EUR 100).
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                11.4 Exceptions
              </h3>
              <p>
                Some jurisdictions do not allow the exclusion of certain
                warranties or limitation of liability for certain damages. In
                such jurisdictions, our liability shall be limited to the
                maximum extent permitted by law.
              </p>
            </section>

            {/* 12. Indemnification */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                12. Indemnification
              </h2>
              <p>
                You agree to indemnify, defend, and hold harmless Memdia, its
                operator (Hakan Bilgic), affiliates, and their respective
                officers, directors, employees, and agents from and against any
                and all claims, damages, losses, liabilities, costs, and
                expenses (including reasonable attorneys' fees) arising out of
                or related to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use of the Service</li>
                <li>Your User Content</li>
                <li>Your violation of these Terms</li>
                <li>
                  Your violation of any applicable laws or third-party rights
                </li>
                <li>
                  Any dispute between you and a third party related to the
                  Service
                </li>
              </ul>
              <p className="mt-4">
                We reserve the right to assume the exclusive defense and control
                of any matter subject to indemnification by you, in which event
                you will cooperate with us in asserting any available defenses.
              </p>
            </section>

            {/* 13. Dispute Resolution */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                13. Dispute Resolution
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                13.1 Informal Resolution
              </h3>
              <p>
                Before initiating any formal dispute resolution proceeding, you
                agree to first contact us at{' '}
                <a
                  href="mailto:hbilgic1992@gmail.com"
                  className="text-[#5a7ba6] hover:text-[#7e9ec9]"
                >
                  hbilgic1992@gmail.com
                </a>{' '}
                and attempt to resolve the dispute informally for at least 30
                days. Most disputes can be resolved through good-faith
                negotiation.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                13.2 Binding Arbitration
              </h3>
              <p>
                If the dispute cannot be resolved informally, you and Memdia
                agree that any dispute, claim, or controversy arising out of or
                relating to these Terms or the Service (except for disputes
                under EUR 500, which may be brought in small claims court) shall
                be resolved by binding arbitration, rather than in court.
              </p>
              <p className="mt-4">
                Arbitration shall be conducted in accordance with the rules of a
                recognized arbitration institution in the European Union. The
                arbitration shall be conducted in English, and the seat of
                arbitration shall be determined by the arbitration institution.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                13.3 Small Claims Exception
              </h3>
              <p>
                Notwithstanding the above, either party may bring an individual
                action in small claims court for disputes or claims within the
                court's jurisdictional limits (generally claims under EUR 500).
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                13.4 Class Action Waiver
              </h3>
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-slate-700 font-medium">
                  YOU AND MEMDIA AGREE THAT EACH MAY BRING CLAIMS AGAINST THE
                  OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A
                  PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE,
                  OR REPRESENTATIVE ACTION. Unless both parties agree otherwise,
                  the arbitrator may not consolidate more than one person's
                  claims and may not preside over any form of representative or
                  class proceeding.
                </p>
              </div>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                13.5 Arbitration Costs
              </h3>
              <p>
                Each party shall bear its own costs and attorneys' fees in any
                arbitration. Arbitration fees shall be shared equally unless the
                arbitrator determines otherwise based on the circumstances of
                the case.
              </p>
            </section>

            {/* 14. Termination */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                14. Termination
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                14.1 Termination by You
              </h3>
              <p>
                You may terminate your account at any time by deleting your
                account through the Service settings or by contacting us at{' '}
                <a
                  href="mailto:hbilgic1992@gmail.com"
                  className="text-[#5a7ba6] hover:text-[#7e9ec9]"
                >
                  hbilgic1992@gmail.com
                </a>
                . Upon termination:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your right to access the Service will immediately cease</li>
                <li>
                  Active subscriptions will not be refunded for the remaining
                  period
                </li>
                <li>
                  Your data will be retained for 30 days (to allow for account
                  recovery) and then permanently deleted
                </li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                14.2 Termination by Memdia
              </h3>
              <p>
                We may suspend or terminate your account immediately, without
                prior notice or liability, if:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You violate these Terms or our Acceptable Use Policy</li>
                <li>
                  Your conduct may harm Memdia, other users, or third parties
                </li>
                <li>We are required to do so by law</li>
                <li>We discontinue the Service</li>
              </ul>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                14.3 Effect of Termination
              </h3>
              <p>
                Upon termination, the following provisions of these Terms shall
                survive: Sections 6 (User Content), 8 (AI Disclaimer), 9
                (Intellectual Property), 11 (Limitation of Liability), 12
                (Indemnification), 13 (Dispute Resolution), and 15 (Governing
                Law).
              </p>
            </section>

            {/* 15. Governing Law */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                15. Governing Law
              </h2>
              <p>
                These Terms and any disputes arising out of or related to these
                Terms or the Service shall be governed by and construed in
                accordance with the laws of the European Union, without regard
                to its conflict of law principles.
              </p>
              <p className="mt-4">
                For users located in Turkey, these Terms shall be interpreted in
                a manner consistent with applicable Turkish consumer protection
                laws where such laws provide greater protection to the user.
              </p>
              <p className="mt-4">
                Nothing in these Terms shall deprive you of the protection
                afforded by mandatory consumer protection laws in your country
                of residence.
              </p>
            </section>

            {/* 16. General Provisions */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                16. General Provisions
              </h2>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.1 Entire Agreement
              </h3>
              <p>
                These Terms, together with our Privacy Policy, constitute the
                entire agreement between you and Memdia regarding the Service
                and supersede all prior agreements and understandings.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.2 Severability
              </h3>
              <p>
                If any provision of these Terms is found to be invalid, illegal,
                or unenforceable, the remaining provisions shall continue in
                full force and effect. The invalid provision shall be modified
                to the minimum extent necessary to make it valid and
                enforceable.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.3 Waiver
              </h3>
              <p>
                Our failure to enforce any right or provision of these Terms
                shall not constitute a waiver of such right or provision. Any
                waiver must be in writing and signed by us to be effective.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.4 Assignment
              </h3>
              <p>
                You may not assign or transfer your rights or obligations under
                these Terms without our prior written consent. We may assign our
                rights and obligations without restriction.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.5 Force Majeure
              </h3>
              <p>
                We shall not be liable for any failure or delay in performance
                due to circumstances beyond our reasonable control, including
                natural disasters, war, terrorism, strikes, government actions,
                or infrastructure failures.
              </p>

              <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">
                16.6 Headings
              </h3>
              <p>
                Section headings are for convenience only and shall not affect
                the interpretation of these Terms.
              </p>
            </section>

            {/* 17. Contact Information */}
            <section className="mb-10">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                17. Contact Information
              </h2>
              <p>
                If you have any questions, concerns, or feedback regarding these
                Terms of Service, please contact us:
              </p>
              <div className="mt-4 p-6 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-medium text-slate-800">Memdia</p>
                <p className="text-slate-600 mt-2">Operated by Hakan Bilgic</p>
                <p className="text-slate-600 mt-2">
                  Email:{' '}
                  <a
                    href="mailto:hbilgic1992@gmail.com"
                    className="text-[#5a7ba6] hover:text-[#7e9ec9]"
                  >
                    hbilgic1992@gmail.com
                  </a>
                </p>
              </div>
              <p className="mt-6 text-sm text-slate-500">
                By using Memdia, you acknowledge that you have read, understood,
                and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
