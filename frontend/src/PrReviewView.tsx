import React, { useState, useEffect } from 'react'
import {
  ShieldAlert, CheckCircle, RefreshCw, MessageSquare, Play,
  Send, ExternalLink, Code2, AlertTriangle, X
} from 'lucide-react'

interface Issue {
  id: string
  category: string
  type: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  file?: string
  message: string
  codeSnippet?: string
  fixCode?: string
  aiFixCode?: string
  aiFixSuggestion?: string
  aiSuggestedTests?: string
}

interface PRReview {
  id: string
  owner: string
  repo: string
  number: number
  status: 'PENDING' | 'COMPLETED' | 'ERROR' | 'REJECTED'
  errorMessage?: string
  createdAt: string
  githubReviewStatus?: string
  githubReviewUrl?: string
  summary: {
    totalIssues: number
    riskScore: number
    severityDistribution: { HIGH: number; MEDIUM: number; LOW: number }
    filesAffected: string[]
  }
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    patch?: string
  }>
  issues: Issue[]
}

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

export function PrReviewView() {
  const [reviews, setReviews] = useState<PRReview[]>([])
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Trigger form
  const [owner, setOwner] = useState('SolankiDhruvraj')
  const [repo, setRepo] = useState('sample-repo')
  const [pullNumber, setPullNumber] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  // Apply fix state
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [fixSuccess, setFixSuccess] = useState<string | null>(null)

  // Chat Drawer state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hello! I am your PR Analysis Agent. Ask me anything about the pull request diff, security concerns, or suggested fixes.' }
  ])
  const [sendingChat, setSendingChat] = useState(false)

  const selectedReview = reviews.find(r => r.id === selectedReviewId) || reviews[0] || null

  const fetchReviews = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pr-reviews')
      if (res.ok) {
        const data = await res.json()
        setReviews(data)
        if (!selectedReviewId && data.length > 0) {
          setSelectedReviewId(data[0].id)
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReviews()
  }, [])

  // Auto-poll if review is pending
  useEffect(() => {
    if (selectedReview?.status === 'PENDING') {
      const interval = setInterval(fetchReviews, 3000)
      return () => clearInterval(interval)
    }
  }, [selectedReview?.status])

  const handleTriggerAudit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!owner.trim() || !repo.trim() || !pullNumber.trim()) return

    setTriggering(true)
    setStatusMessage(null)

    try {
      const res = await fetch('/api/pr-reviews/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: owner.trim(),
          repo: repo.trim(),
          pullNumber: Number(pullNumber)
        })
      })

      const data = await res.json()
      if (res.ok && data.review) {
        setStatusMessage({ text: `Analysis triggered for PR #${pullNumber}! Auditing static AST & security rules...` })
        setReviews(prev => [data.review, ...prev.filter(r => r.id !== data.review.id)])
        setSelectedReviewId(data.review.id)
      } else {
        setStatusMessage({ text: data.error || 'Failed to trigger review', isError: true })
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Network error triggering review', isError: true })
    } finally {
      setTriggering(false)
    }
  }

  const handleApplyFix = async (issue: Issue) => {
    if (!selectedReview) return
    setFixingId(issue.id)
    setFixSuccess(null)

    try {
      const res = await fetch('/api/pr-reviews/apply-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: selectedReview.owner,
          repo: selectedReview.repo,
          pullNumber: selectedReview.number,
          filename: issue.file,
          oldSnippet: issue.codeSnippet,
          newSnippet: issue.aiFixCode || issue.fixCode
        })
      })

      const data = await res.json()
      if (res.ok) {
        setFixSuccess(`Successfully committed AI fix to ${issue.file || 'PR branch'}!`)
      } else {
        alert(data.error || 'Failed to apply fix')
      }
    } catch (err: any) {
      alert(err.message || 'Error applying fix')
    } finally {
      setFixingId(null)
    }
  }

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || sendingChat || !selectedReview) return

    const question = chatInput.trim()
    setChatMessages(prev => [...prev, { role: 'user', text: question }])
    setChatInput('')
    setSendingChat(true)

    try {
      const res = await fetch('/api/pr-reviews/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: selectedReview.owner,
          repo: selectedReview.repo,
          pullNumber: selectedReview.number,
          question
        })
      })

      const data = await res.json()
      if (res.ok && data.answer) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.answer }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Error: ${data.error || 'Unable to generate response'}` }])
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Network error: ${err.message}` }])
    } finally {
      setSendingChat(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 10 }}>
      {/* ── Trigger Audit Header Panel ── */}
      <section className="section" style={{
        background: '#ffffff',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '24px 28px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <span className="kicker" style={{ color: '#256553' }}>INTELLIGENT PR AUDIT & AI FIXES</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: 22 }}>PR Insights & Automated Code Review</h2>
            <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#5f6f67' }}>
              Multi-vector static AST analysis + live Gemini-powered vulnerability remediation & one-click branch commit.
            </p>
          </div>
          <button className="secondary compact" onClick={fetchReviews} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Sync Audits
          </button>
        </div>

        <form onSubmit={handleTriggerAudit} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#7a8883', display: 'block', marginBottom: 4 }}>REPO OWNER</label>
            <input
              style={{ width: 140, padding: '8px 12px', borderRadius: 8, border: '1px solid #c9d8d1', fontSize: 13 }}
              value={owner}
              onChange={e => setOwner(e.target.value)}
              placeholder="e.g. SolankiDhruvraj"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#7a8883', display: 'block', marginBottom: 4 }}>REPOSITORY</label>
            <input
              style={{ width: 170, padding: '8px 12px', borderRadius: 8, border: '1px solid #c9d8d1', fontSize: 13 }}
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="e.g. sample-repo"
              required
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#7a8883', display: 'block', marginBottom: 4 }}>PR NUMBER</label>
            <input
              type="number"
              style={{ width: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid #c9d8d1', fontSize: 13 }}
              value={pullNumber}
              onChange={e => setPullNumber(e.target.value)}
              placeholder="e.g. 8"
              required
            />
          </div>
          <button className="primary" type="submit" disabled={triggering} style={{ padding: '9px 18px' }}>
            <Play size={14}/> {triggering ? 'Auditing PR...' : 'Run PR Analysis'}
          </button>
        </form>

        {statusMessage && (
          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            background: statusMessage.isError ? '#fef2f2' : '#f0fdf4',
            color: statusMessage.isError ? '#991b1b' : '#166534',
            border: `1px solid ${statusMessage.isError ? '#fecaca' : '#bbf7d0'}`
          }}>
            {statusMessage.text}
          </div>
        )}
      </section>

      {/* ── Main Layout: Audits list on left, Details on right ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Recent Audits */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1a2420' }}>Recent PR Audits</h3>
          {reviews.length === 0 ? (
            <div style={{ color: '#7a8883', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No PR reviews found. Enter a PR above and click "Run PR Analysis".
            </div>
          ) : (
            reviews.map(r => {
              const isSelected = selectedReview?.id === r.id
              const highCount = r.summary?.severityDistribution?.HIGH || 0
              const medCount = r.summary?.severityDistribution?.MEDIUM || 0
              const lowCount = r.summary?.severityDistribution?.LOW || 0
              const riskScore = r.summary?.riskScore || 0

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedReviewId(r.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: isSelected ? '2px solid #256553' : '1px solid #e1e9e5',
                    background: isSelected ? '#f4fbf7' : '#fafcfb',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1a2420' }}>
                      {r.owner}/{r.repo} #{r.number}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: riskScore > 10 ? '#fee2e2' : '#dcfce7',
                      color: riskScore > 10 ? '#991b1b' : '#166534'
                    }}>
                      Risk {riskScore}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#5f6f67' }}>
                    <span style={{ color: '#dc2626' }}>● {highCount} High</span>
                    <span style={{ color: '#d97706' }}>● {medCount} Med</span>
                    <span style={{ color: '#0284c7' }}>● {lowCount} Low</span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Right Column: Review Details */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: 24,
          minHeight: 480
        }}>
          {!selectedReview ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#7a8883' }}>
              Select an audit from the left or trigger an analysis to inspect detected issues.
            </div>
          ) : selectedReview.status === 'PENDING' ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🛡️</div>
              <h3 style={{ margin: 0, fontSize: 18 }}>PR Analysis Underway</h3>
              <p style={{ color: '#5f6f67', fontSize: 13, marginTop: 6 }}>
                Fetching git diff, running multi-vector AST analyzer, and enriching fixes via Google Gemini...
              </p>
            </div>
          ) : (
            <div>
              {/* Review Header Stats */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e1e9e5', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, color: '#1a2420' }}>
                    {selectedReview.owner}/{selectedReview.repo} · Pull Request #{selectedReview.number}
                  </h3>
                  <div style={{ fontSize: 12, color: '#5f6f67', marginTop: 4 }}>
                    Status: <b style={{ color: selectedReview.status === 'REJECTED' ? '#dc2626' : '#166534' }}>{selectedReview.status}</b>
                    {' '}• {selectedReview.files?.length || 0} Files Changed • {selectedReview.issues?.length || 0} Total Violations
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="primary compact"
                    style={{ background: chatOpen ? '#c9772a' : '#256553' }}
                    onClick={() => setChatOpen(!chatOpen)}
                  >
                    <MessageSquare size={14}/> {chatOpen ? 'Hide PR Agent' : 'Ask PR Agent'}
                  </button>
                  {selectedReview.githubReviewUrl && (
                    <a
                      href={selectedReview.githubReviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary compact"
                      style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <ExternalLink size={14}/> GitHub
                    </a>
                  )}
                </div>
              </div>

              {fixSuccess && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '10px 14px', borderRadius: 8, marginBottom: 18, fontSize: 13 }}>
                  <CheckCircle size={15} style={{ verticalAlign: 'middle', marginRight: 6 }}/>
                  {fixSuccess}
                </div>
              )}

              {/* Detected Issues List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {selectedReview.issues.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#166534', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                    <CheckCircle size={28} style={{ marginBottom: 8 }}/>
                    <div style={{ fontWeight: 700 }}>Zero Violations Detected</div>
                    <div style={{ fontSize: 12, marginTop: 4, color: '#4b7561' }}>This pull request passed all safety, bug, performance, and complexity checks.</div>
                  </div>
                ) : (
                  selectedReview.issues.map(issue => (
                    <div key={issue.id} style={{
                      border: '1px solid #e1e9e5',
                      borderLeft: `4px solid ${issue.severity === 'HIGH' ? '#dc2626' : issue.severity === 'MEDIUM' ? '#d97706' : '#0284c7'}`,
                      borderRadius: 10,
                      padding: 16,
                      background: '#ffffff'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#7a8883' }}>
                            {issue.category} · {issue.type} {issue.file && `(${issue.file})`}
                          </span>
                          <h4 style={{ margin: '4px 0 0 0', fontSize: 14, color: '#1a2420' }}>
                            {issue.message}
                          </h4>
                        </div>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: issue.severity === 'HIGH' ? '#fee2e2' : issue.severity === 'MEDIUM' ? '#fef3c7' : '#e0f2fe',
                          color: issue.severity === 'HIGH' ? '#991b1b' : issue.severity === 'MEDIUM' ? '#92400e' : '#0369a1'
                        }}>
                          {issue.severity}
                        </span>
                      </div>

                      {issue.codeSnippet && (
                        <div style={{ marginTop: 10, background: '#1c2421', borderRadius: 8, padding: 10, overflowX: 'auto' }}>
                          <div style={{ fontSize: 10, color: '#889891', marginBottom: 4, fontWeight: 700 }}>VULNERABLE CONTEXT</div>
                          <pre style={{ margin: 0, color: '#f8faf9', fontSize: 11, fontFamily: 'monospace' }}><code>{issue.codeSnippet}</code></pre>
                        </div>
                      )}

                      {(issue.aiFixCode || issue.fixCode) && (
                        <div style={{ marginTop: 10, background: '#f4fbf7', border: '1px solid #c9e8d7', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>
                              AI Remediation Patch
                            </span>
                            <button
                              className="primary compact"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => handleApplyFix(issue)}
                              disabled={fixingId === issue.id}
                            >
                              <Code2 size={12}/> {fixingId === issue.id ? 'Committing...' : 'Apply AI Fix (Commit)'}
                            </button>
                          </div>
                          <pre style={{ margin: 0, color: '#14532d', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto' }}>
                            <code>{issue.aiFixCode || issue.fixCode}</code>
                          </pre>
                        </div>
                      )}

                      {issue.aiSuggestedTests && (
                        <div style={{ marginTop: 10, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>
                            🧪 Automated Unit Test Suite
                          </div>
                          <pre style={{ margin: 0, color: '#0c4a6e', fontSize: 11, fontFamily: 'monospace', overflowX: 'auto' }}>
                            <code>{issue.aiSuggestedTests}</code>
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-over Interactive Gemini PR Chat Drawer ── */}
      {chatOpen && selectedReview && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 440,
          height: '100vh',
          background: '#ffffff',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e1e9e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>PR Agent Discussion</h3>
              <span style={{ fontSize: 11, color: '#5f6f67' }}>PR #{selectedReview.number} · {selectedReview.owner}/{selectedReview.repo}</span>
            </div>
            <button style={{ background: 'transparent', padding: 4, color: '#7a8883' }} onClick={() => setChatOpen(false)}>
              <X size={18}/>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.5,
                background: msg.role === 'user' ? '#256553' : '#f4f7f5',
                color: msg.role === 'user' ? '#ffffff' : '#1a2420'
              }}>
                {msg.text}
              </div>
            ))}
            {sendingChat && (
              <div style={{ alignSelf: 'flex-start', background: '#f4f7f5', padding: '10px 14px', borderRadius: 12, fontSize: 12, color: '#5f6f67' }}>
                Reasoning with Gemini about PR context...
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} style={{ padding: 16, borderTop: '1px solid #e1e9e5', display: 'flex', gap: 8 }}>
            <input
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #c9d8d1', fontSize: 13 }}
              placeholder="Ask about security, fixes, or diff..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={sendingChat}
            />
            <button className="primary compact" type="submit" disabled={sendingChat || !chatInput.trim()}>
              <Send size={14}/>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
