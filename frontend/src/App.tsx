import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowRight, CheckCircle2, CircleDollarSign, ExternalLink,
  GitFork, History, LogIn, LogOut, Plus, Server, ShieldCheck,
  Sparkles, Terminal, UserCheck, X, Zap, Cpu, Award, Webhook, RefreshCw, FileSearch
} from 'lucide-react'
import { PrReviewView } from './PrReviewView'
import './styles.css'

type MarketplaceAgent = {
  slug: string
  name: string
  description: string
  stack: string
  price: string
  priceInr: number
  availability: string
  verifiedSuccessRate: number
  medianResolutionTime: string
  capabilities: string[]
  version: string
}

type UserSubscription = {
  id: string
  organizationId: string
  agentSlug: string
  agentName: string
  purchasedAt: string
  status: string
  priceInr: number
}

type Run = {
  id: string
  agentName: string
  agentSlug?: string
  repository: string
  issueNumber: number
  issueTitle: string
  status: string
  costInr?: number
  cost?: number
  createdAt: string
  assignedWorkerId?: string
  currentStep?: string
  diffSummary?: string
  pullRequestUrl?: string
  inputTokens?: number
  outputTokens?: number
  executionTimeMs?: number
}

type WorkerNode = {
  workerId: string
  hostname: string
  ipAddress: string
  supportedSkills: string[]
  status: 'IDLE' | 'BUSY' | 'OFFLINE'
  completedRunsCount: number
  activeRunId?: string
}

type WebhookDelivery = {
  id: string
  deliveryId: string
  eventType: string
  status: string
  repository: string
  issueNumber?: number
  action: string
  receivedAt: string
  processedAt?: string
  payloadSummary?: {
    sender?: string
    label?: string
    issueTitle?: string
  }
}

const fallbackMarketplace: MarketplaceAgent[] = [
  {
    slug: 'bug-fix',
    name: 'Bug Fix Specialist (Senior L5)',
    description: 'Autonomous software engineer with Dual-Critic review, SBFL fault localization, and automated style linting.',
    stack: 'Java · TypeScript · Python · Go',
    price: '₹320 / successful PR',
    priceInr: 320,
    availability: 'Ready',
    verifiedSuccessRate: 94.8,
    medianResolutionTime: '3m 40s',
    capabilities: ['AST Symbol Search', 'SBFL Ochiai Localization', 'Adversarial Senior Critic', 'Automated Linter Guard', 'Test Runner'],
    version: '2.0.0'
  },
  {
    slug: 'dependency-remediation',
    name: 'Dependency Remediation Specialist (Staff L6)',
    description: 'CVE security vulnerability scanner with SemVer compatibility analysis and non-destructive manifest patching.',
    stack: 'Java (Maven/Gradle) · Node.js (npm)',
    price: '₹190 / successful PR',
    priceInr: 190,
    availability: 'Ready',
    verifiedSuccessRate: 98.2,
    medianResolutionTime: '2m 10s',
    capabilities: ['CVE Advisory Scanner', 'SemVer Compatibility Analyzer', 'Manifest Modifier', 'Critic Audit', 'Regression Tests'],
    version: '2.0.0'
  },
  {
    slug: 'test-repair',
    name: 'Test Repair Specialist (Senior L5)',
    description: 'Isolates test flakiness with multi-run diagnostics, synchronizes mock contracts, and repairs assertions without masking defects.',
    stack: 'Java (JUnit 5) · TypeScript (Jest/Vitest)',
    price: '₹240 / successful PR',
    priceInr: 240,
    availability: 'Ready',
    verifiedSuccessRate: 91.5,
    medianResolutionTime: '2m 55s',
    capabilities: ['Multi-Run Flakiness Tool', 'Mock Synchronizer', 'Assertion Doctor', 'Senior Critic Audit'],
    version: '2.0.0'
  },
  {
    slug: 'pr-review',
    name: 'PR Code Review & Audit Specialist (Staff L6)',
    description: 'Multi-vector static analyzer & interactive PR auditor. Detects security flaws, bugs, performance leaks, computes risk scores, commits AI fixes, and provides live PR chat.',
    stack: 'JavaScript · TypeScript · Python · Java · Go',
    price: '₹150 / PR audit',
    priceInr: 150,
    availability: 'Ready',
    verifiedSuccessRate: 97.4,
    medianResolutionTime: '45s',
    capabilities: ['Multi-Vector Static Analyzer', 'Risk Scoring Engine', 'One-Click AI Fix Committer', 'Automated Test Suite Generator', 'Interactive Gemini PR Chat'],
    version: '2.1.0'
  }
]

const statusLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, x => x.toUpperCase())

function App() {
  // Navigation: 'marketplace' (public, no auth) or 'workspace' (customer portal, auth required) or 'pr-reviews'
  const [activeTab, setActiveTab] = useState<'marketplace' | 'workspace' | 'pr-reviews'>('marketplace')

  // Authentication State persisted in localStorage
  const [authToken, setAuthToken] = useState<string>(() => localStorage.getItem('forgeflow_token') || '')
  const [currentUser, setCurrentUser] = useState<string>(() => localStorage.getItem('forgeflow_user') || '')
  const [currentOrg, setCurrentOrg] = useState<string>(() => localStorage.getItem('forgeflow_org') || '')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(localStorage.getItem('forgeflow_token') || localStorage.getItem('forgeflow_user')))
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login')
  const [loginModalOpen, setLoginModalOpen] = useState<boolean>(false)
  const [authForm, setAuthForm] = useState({ username: '', orgId: '', password: '' })
  const [authError, setAuthError] = useState<string>('')

  // Data
  const [marketplaceAgents, setMarketplaceAgents] = useState<MarketplaceAgent[]>(fallbackMarketplace)
  const [mySubscriptions, setMySubscriptions] = useState<UserSubscription[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [workers, setWorkers] = useState<WorkerNode[]>([])
  const [webhooks, setWebhooks] = useState<WebhookDelivery[]>([])
  const [budgetInfo, setBudgetInfo] = useState<{ availableBalanceInr: number; recentLedger: any[] }>({
    availableBalanceInr: 15000,
    recentLedger: []
  })

  // Modals & Forms
  const [openDispatchModal, setOpenDispatchModal] = useState(false)
  const [selectedAgentForDispatch, setSelectedAgentForDispatch] = useState('bug-fix')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState({
    repository: '',
    issueNumber: '',
    issueTitle: ''
  })

  // Real Authentication handler (Login & Signup)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    if (!authForm.username.trim() || !authForm.password) {
      setAuthError('Username and password are required.')
      return
    }

    const endpoint = authModalMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: authForm.username.trim(),
          password: authForm.password,
          orgId: authForm.orgId.trim()
        })
      })

      const data = await res.json()
      if (res.ok) {
        setAuthToken(data.token)
        setCurrentUser(data.username)
        setCurrentOrg(data.orgId)
        setIsAuthenticated(true)
        localStorage.setItem('forgeflow_token', data.token)
        localStorage.setItem('forgeflow_user', data.username)
        localStorage.setItem('forgeflow_org', data.orgId)
        setLoginModalOpen(false)
        setAuthError('')
        setNotice(authModalMode === 'signup' ? `Account created! Welcome, ${data.username}.` : `Welcome back, ${data.username}!`)
        setActiveTab('workspace')
      } else {
        setAuthError(data.error || 'Authentication failed. Please check your credentials.')
      }
    } catch {
      setAuthError('Authentication server unreachable. Please check backend.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setCurrentUser('')
    setCurrentOrg('')
    setAuthToken('')
    localStorage.removeItem('forgeflow_token')
    localStorage.removeItem('forgeflow_user')
    localStorage.removeItem('forgeflow_org')
    setMySubscriptions([])
    setRuns([])
    setActiveTab('marketplace')
    setNotice('Logged out successfully.')
  }

  // Fetch Public Marketplace (No auth needed)
  const loadMarketplace = async () => {
    try {
      const res = await fetch('/api/marketplace/agents')
      if (res.ok) setMarketplaceAgents(await res.json())
    } catch {
      setMarketplaceAgents(fallbackMarketplace)
    }
  }

  // Fetch User's Private Workspace Data (Only for authenticated user)
  const loadUserData = async () => {
    if (!isAuthenticated) return
    try {
      const [profileRes, runsRes, workersRes, webhooksRes, budgetRes] = await Promise.all([
        fetch('/api/user/me', { headers: { 'X-Org-Id': currentOrg } }),
        fetch('/api/user/runs', { headers: { 'X-Org-Id': currentOrg } }),
        fetch('/api/worker/nodes'),
        fetch('/api/webhooks/deliveries'),
        fetch('/api/orchestration/budget', { headers: { 'X-Org-Id': currentOrg } })
      ])

      if (profileRes.ok) {
        const profile = await profileRes.json()
        setMySubscriptions(profile.activeAgents || [])
      }
      if (runsRes.ok) setRuns(await runsRes.json())
      if (workersRes.ok) setWorkers(await workersRes.json())
      if (webhooksRes.ok) setWebhooks(await webhooksRes.json())
      if (budgetRes.ok) setBudgetInfo(await budgetRes.json())
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    loadMarketplace()
    loadUserData()
    const timer = setInterval(() => {
      loadUserData()
    }, 3000)
    return () => clearInterval(timer)
  }, [isAuthenticated, currentOrg])

  // Check if a specific agent is owned/purchased
  const isAgentOwned = (slug: string) => {
    return mySubscriptions.some(sub => sub.agentSlug.toLowerCase() === slug.toLowerCase())
  }

  // Handle purchasing an agent from public marketplace
  const handlePurchase = async (agent: MarketplaceAgent) => {
    if (!isAuthenticated) {
      setNotice('Please sign in to hire agents for your engineering team.')
      return
    }

    try {
      const res = await fetch('/api/user/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': currentOrg
        },
        body: JSON.stringify({ agentSlug: agent.slug })
      })

      if (res.status === 201) {
        setNotice(`🎉 Successfully hired ${agent.name}! It is now available in your Workspace.`)
        await loadUserData()
        setActiveTab('workspace')
      } else if (res.status === 409) {
        setNotice(`You already have ${agent.name} in your workforce.`)
        setActiveTab('workspace')
      } else {
        throw new Error()
      }
    } catch {
      setNotice(`Failed to hire agent. Make sure the backend server is running.`)
    }
  }

  // Handle dispatching a run to a purchased agent
  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAgentOwned(selectedAgentForDispatch)) {
      setNotice(`You must hire this agent from the marketplace before deploying it!`)
      return
    }

    try {
      const res = await fetch('/api/user/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Org-Id': currentOrg
        },
        body: JSON.stringify({
          agentSlug: selectedAgentForDispatch,
          repository: form.repository,
          issueNumber: Number(form.issueNumber),
          issueTitle: form.issueTitle
        })
      })

      if (res.ok) {
        setOpenDispatchModal(false)
        setNotice(`Task queued! A remote worker specialized in this skill will claim it.`)
        loadUserData()
      } else {
        const err = await res.json()
        setNotice(err.detail || 'Could not queue task.')
      }
    } catch {
      setNotice('API server unreachable.')
    }
  }

  const totalSpend = useMemo(() => {
    return runs.reduce((sum, run) => sum + (run.costInr || run.cost || 0), 0)
  }, [runs])

  return (
    <main>
      {/* Top Navbar */}
      <nav>
        <a className="brand" href="#top">
          <span className="brand-mark">f</span>forgeflow
        </a>

        {/* Tab Navigation */}
        <div className="nav-links">
          <button
            className={`nav-tab-btn ${activeTab === 'marketplace' ? 'active' : ''}`}
            onClick={() => setActiveTab('marketplace')}
          >
            Public Marketplace
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => {
              if (!isAuthenticated) {
                setNotice('Please sign in to access your customer workspace.')
              } else {
                setActiveTab('workspace')
              }
            }}
          >
            My Workspace {mySubscriptions.length > 0 && `(${mySubscriptions.length})`}
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'pr-reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('pr-reviews')}
          >
            <FileSearch size={14} style={{ verticalAlign: 'middle', marginRight: 4 }}/> PR Insights & Review
          </button>
        </div>

        {/* Auth status & controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAuthenticated ? (
            <div className="auth-badge">
              <UserCheck size={15}/> {currentUser || 'User'} ({currentOrg})
              <button
                style={{ background: 'transparent', color: '#c35b43', marginLeft: 6, padding: 0 }}
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={14}/>
              </button>
            </div>
          ) : (
            <button
              className="primary compact"
              onClick={() => setLoginModalOpen(true)}
            >
              <LogIn size={15}/> Sign In / Workspace Login
            </button>
          )}
          <a
            className="ghost"
            href="https://github.com/apps/forgeflow-agent-dhruv/installations/new"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <GitFork size={16}/> Connect GitHub
          </a>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: PUBLIC MARKETPLACE VIEW (NO AUTH REQUIRED)                         */}
      {/* ========================================================================= */}
      {activeTab === 'marketplace' && (
        <div>
          <section id="top" className="hero">
            <div className="eyebrow"><Sparkles size={15}/> PUBLIC AI WORKFORCE MARKETPLACE</div>
            <h1>Hire specialized AI engineers.<br/><em>Pay only for accepted PRs.</em></h1>
            <p>
              Discover independently verified, task-specialized AI agents. Unlike generic chatbots,
              Forgeflow agents investigate GitHub issues, modify private code in sandboxes, run tests, and open clean pull requests.
            </p>
            <div className="hero-actions">
              <a className="primary" href="#catalog">
                Explore available agents <ArrowRight size={18}/>
              </a>
              {isAuthenticated && (
                <button className="text-button" onClick={() => setActiveTab('workspace')}>
                  Open your hired workforce ({mySubscriptions.length}) <ArrowRight size={16}/>
                </button>
              )}
            </div>
            <div className="trust-row">
              <span><CheckCircle2 size={16}/> Public & Unrestricted Catalog</span>
              <span><Award size={16}/> Verified Resolution Benchmarks</span>
              <span><ShieldCheck size={16}/> Isolated Sandboxed Execution</span>
            </div>
          </section>

          {/* Catalog Section */}
          <section id="catalog" className="section" style={{ paddingTop: 30 }}>
            <div className="section-top">
              <div>
                <span className="kicker">FIRST-PARTY SPECIALIST CATALOG</span>
                <h2>Discover & Hire AI Employees</h2>
              </div>
              <span className="text-button">
                Showing {marketplaceAgents.length} verified engineering specialists
              </span>
            </div>

            <div className="agent-grid">
              {marketplaceAgents.map((agent) => {
                const owned = isAgentOwned(agent.slug)
                return (
                  <article className="agent-card" key={agent.slug}>
                    <div className="card-top">
                      <div className="agent-icon"><Activity/></div>
                      {owned ? (
                        <span className="owned-badge"><CheckCircle2 size={12}/> Hired</span>
                      ) : (
                        <span className="tag ready">{agent.availability}</span>
                      )}
                    </div>

                    <h3>{agent.name} <small style={{ fontSize: 11, color: '#7a8883' }}>v{agent.version}</small></h3>
                    <p>{agent.description}</p>

                    <div className="benchmark-badge">
                      <span><b>{agent.verifiedSuccessRate}%</b> Test resolution rate</span>
                      <span><b>{agent.medianResolutionTime}</b> Median time</span>
                    </div>

                    <div className="capabilities-list">
                      {agent.capabilities.map(cap => (
                        <span className="cap-pill" key={cap}>{cap}</span>
                      ))}
                    </div>

                    <div className="card-meta">
                      <span>{agent.stack}</span>
                      <strong>{agent.price}</strong>
                    </div>

                    {owned ? (
                      <button
                        className="outline"
                        style={{ background: '#eef8f3', borderColor: '#a7d5be' }}
                        onClick={() => {
                          setSelectedAgentForDispatch(agent.slug)
                          setActiveTab('workspace')
                          setOpenDispatchModal(true)
                        }}
                      >
                        Deploy from Workspace <ArrowRight size={16}/>
                      </button>
                    ) : (
                      <button
                        className="primary"
                        style={{ marginTop: 14, justifyContent: 'center' }}
                        onClick={() => handlePurchase(agent)}
                      >
                        Hire Agent ({agent.price.split('/')[0].trim()}) <ArrowRight size={16}/>
                      </button>
                    )}
                  </article>
                )
              })}
            </div>
          </section>

          {/* Trust & Architecture Guardrails */}
          <section id="trust" className="trust-section">
            <div>
              <span className="kicker">DEFENSIBLE PROPRIETARY MOATS</span>
              <h2>Why prompted wrappers fail and Forgeflow wins.</h2>
            </div>
            <div className="guardrails">
              <p><Zap/> <b>Voyage AI Code RAG (voyage-code-3):</b> State-of-the-art dense code embeddings stored in MongoDB</p>
              <p><Server/> <b>Compiler AST Graph Slicing:</b> Traces class hierarchies and cuts prompt tokens by 90%</p>
              <p><Activity/> <b>MongoDB Vector Episodic Memory:</b> Recalls top verified PR patches from similar historical bugs</p>
              <p><ShieldCheck/> <b>AST Diff Safety Gate:</b> Blocks diffs that delete test assertions or break public API contracts</p>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRIVATE CUSTOMER WORKSPACE (AUTH REQUIRED)                        */}
      {/* ========================================================================= */}
      {activeTab === 'workspace' && (
        <div>
          {/* Customer Organization Banner */}
          <section className="metrics" style={{ marginTop: 0 }}>
            <div>
              <b>{mySubscriptions.length}</b>
              <span>hired specialized agents</span>
            </div>
            <div>
              <b>{runs.length}</b>
              <span>backlog issues resolved</span>
            </div>
            <div>
              <b>₹{budgetInfo.availableBalanceInr.toFixed(0)}</b>
              <span>available ledger balance (Phase 3)</span>
            </div>
          </section>

          {/* Section: Hired Workforce */}
          <section className="section" style={{ paddingBottom: 40 }}>
            <div className="section-top">
              <div>
                <span className="kicker">YOUR HIRED WORKFORCE</span>
                <h2>Active AI Employees</h2>
              </div>
              <button
                className="primary compact"
                onClick={() => setOpenDispatchModal(true)}
                disabled={mySubscriptions.length === 0}
              >
                <Plus size={16}/> Dispatch issue to agent
              </button>
            </div>

            {mySubscriptions.length > 0 ? (
              <div className="agent-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
                {mySubscriptions.map(sub => {
                  const meta = marketplaceAgents.find(a => a.slug === sub.agentSlug)
                  return (
                    <article className="agent-card" key={sub.id} style={{ minHeight: 240 }}>
                      <div className="card-top">
                        <div className="agent-icon"><Cpu/></div>
                        <span className="owned-badge"><CheckCircle2 size={12}/> Ready for work</span>
                      </div>
                      <h3>{sub.agentName}</h3>
                      <p>{meta?.description || 'Hired AI specialist'}</p>
                      <div className="card-meta">
                        <span>Hired: {new Date(sub.purchasedAt).toLocaleDateString()}</span>
                        <strong>{meta?.stack || 'Java · TypeScript'}</strong>
                      </div>
                      <button
                        className="outline"
                        onClick={() => {
                          setSelectedAgentForDispatch(sub.agentSlug)
                          setOpenDispatchModal(true)
                        }}
                      >
                        Assign GitHub Issue <ArrowRight size={16}/>
                      </button>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state-card">
                <h3>You haven't hired any agents yet.</h3>
                <p>Browse the public marketplace to find and hire an agent for your tech stack.</p>
                <button
                  className="primary"
                  style={{ marginTop: 14 }}
                  onClick={() => setActiveTab('marketplace')}
                >
                  Browse Marketplace <ArrowRight size={16}/>
                </button>
              </div>
            )}
          </section>

          {/* Section: Distributed Workers */}
          <section className="section" style={{ paddingTop: 0, paddingBottom: 40 }}>
            <div className="section-top">
              <div>
                <span className="kicker">EXECUTION FLEET</span>
                <h2>Dedicated Worker Nodes</h2>
              </div>
              <span className="text-button">
                {workers.filter(w => w.status !== 'OFFLINE').length || 1} online server(s)
              </span>
            </div>

            <div className="worker-grid">
              {workers.length > 0 ? workers.map(w => (
                <div className="worker-card" key={w.workerId}>
                  <div className="worker-card-header">
                    <h4><Server size={16}/> {w.workerId}</h4>
                    <span className={`worker-pill ${w.status === 'BUSY' ? 'busy' : ''}`}>{w.status}</span>
                  </div>
                  <p>Host: {w.hostname} ({w.ipAddress})</p>
                  <p>Jobs processed: {w.completedRunsCount}</p>
                  <div className="skill-tags">
                    {w.supportedSkills.map(s => <span className="skill-tag" key={s}>{s}</span>)}
                  </div>
                </div>
              )) : (
                <div className="worker-card">
                  <div className="worker-card-header">
                    <h4><Server size={16}/> worker-node-daemon-1</h4>
                    <span className="worker-pill">STANDBY</span>
                  </div>
                  <p>Host: srv-remote-us.forgeflow.net (192.168.1.12)</p>
                  <p>Specialization: Bug Fixer, Dependency Remediation, Test Repair</p>
                  <div className="skill-tags">
                    <span className="skill-tag">bug-fix</span>
                    <span className="skill-tag">dependency-remediation</span>
                    <span className="skill-tag">test-repair</span>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section: Task Run History & Diffs */}
          <section className="section runs" style={{ paddingTop: 0 }}>
            <div className="section-top">
              <div>
                <span className="kicker">WORK QUEUE & AUDIT TRAIL</span>
                <h2>Execution History & Pull Requests</h2>
              </div>
            </div>

            <div className="run-table">
              <div className="table-head">
                <span>Issue & Repository</span>
                <span>Assigned Agent</span>
                <span>Status & Worker</span>
                <span>Tokens & Spend</span>
                <span>PR & Diff</span>
              </div>

              {runs.length ? runs.map(run => (
                <div
                  className="run-row"
                  key={run.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.1fr 1.3fr 0.8fr 1fr',
                    padding: '16px 20px',
                    borderTop: '1px solid var(--line)'
                  }}
                >
                  <div>
                    <b>#{run.issueNumber} · {run.issueTitle}</b>
                    <small>{run.repository}</small>
                    {run.currentStep && (
                      <div className="run-step-badge">
                        <Terminal size={11} style={{ verticalAlign: 'middle', marginRight: 4 }}/>
                        {run.currentStep}
                      </div>
                    )}
                  </div>

                  <span>{run.agentName}</span>

                  <div>
                    <span className={'status ' + run.status.toLowerCase()}><i/>{statusLabel(run.status)}</span>
                    <small style={{ color: '#7a8883', display: 'block', marginTop: 4 }}>
                      {run.assignedWorkerId ? `Node: ${run.assignedWorkerId}` : 'Awaiting worker'}
                    </small>
                  </div>

                  <div>
                    <b>₹{(run.costInr || run.cost || 0).toFixed(0)}</b>
                    {(run.inputTokens || run.outputTokens) ? (
                      <div className="token-stat">{run.inputTokens} in / {run.outputTokens} out</div>
                    ) : <div className="token-stat">Budget Capped</div>}
                  </div>

                  <div>
                    {run.pullRequestUrl ? (
                      <a href={run.pullRequestUrl} target="_blank" rel="noreferrer" className="pr-link">
                        Review PR <ExternalLink size={12}/>
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: '#889590' }}>In Progress</span>
                    )}
                    {run.diffSummary && (
                      <details style={{ marginTop: 6, fontSize: 11 }}>
                        <summary style={{ cursor: 'pointer', color: '#256553' }}>Inspect Patch</summary>
                        <div className="diff-box">{run.diffSummary}</div>
                      </details>
                    )}
                  </div>
                </div>
              )) : (
                <div className="empty">
                  <History size={22}/>
                  <span>No tasks run yet. Click "Dispatch issue to agent" to initiate work.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PR INSIGHTS & CODE REVIEW (INTEGRATED PR-ANALYSIS)                 */}
      {/* ========================================================================= */}
      {activeTab === 'pr-reviews' && (
        <PrReviewView />
      )}

      {/* Toast Notification */}
      {notice && (
        <div className="toast">
          {notice}
          <button onClick={() => setNotice('')}><X size={16}/></button>
        </div>
      )}

      {/* Modal: Sign In / Workspace Login & Signup */}
      {loginModalOpen && (
        <div className="modal-backdrop" onMouseDown={() => setLoginModalOpen(false)}>
          <form className="modal" onSubmit={handleAuthSubmit} onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setLoginModalOpen(false)}>
              <X size={18}/>
            </button>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                className={authModalMode === 'login' ? 'primary compact' : 'ghost compact'}
                onClick={() => { setAuthModalMode('login'); setAuthError(''); }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={authModalMode === 'signup' ? 'primary compact' : 'ghost compact'}
                onClick={() => { setAuthModalMode('signup'); setAuthError(''); }}
              >
                Create Account (Sign Up)
              </button>
            </div>

            <span className="kicker">WORKSPACE ACCESS</span>
            <h2>{authModalMode === 'signup' ? 'Create a New Account' : 'Sign In to Your Workspace'}</h2>
            <p>{authModalMode === 'signup' ? 'Register your username and password to secure your workspace.' : 'Enter your registered credentials to access your hired AI employees.'}</p>

            {authError && (
              <div style={{
                background: '#fee2e2',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 14,
                border: '1px solid #f87171'
              }}>
                {authError}
              </div>
            )}

            <label>
              Username / Email
              <input
                type="text"
                placeholder="e.g. dhruvrajsolanki"
                value={authForm.username}
                onChange={e => setAuthForm({ ...authForm, username: e.target.value })}
                required
                autoFocus
              />
            </label>

            {authModalMode === 'signup' && (
              <label>
                Organization / Team ID
                <input
                  type="text"
                  placeholder="e.g. acme-payments (optional)"
                  value={authForm.orgId}
                  onChange={e => setAuthForm({ ...authForm, orgId: e.target.value })}
                />
              </label>
            )}

            <label>
              Password
              <input
                type="password"
                placeholder="Min 6 characters"
                value={authForm.password}
                onChange={e => setAuthForm({ ...authForm, password: e.target.value })}
                required
              />
            </label>

            <button className="primary full" type="submit" style={{ marginTop: 10 }}>
              {authModalMode === 'signup' ? 'Create Account & Allocate Balance' : 'Sign In'} <ArrowRight size={17}/>
            </button>
          </form>
        </div>
      )}

      {/* Modal: Dispatch Issue to Hired Agent */}
      {openDispatchModal && (
        <div className="modal-backdrop" onMouseDown={() => setOpenDispatchModal(false)}>
          <form className="modal" onSubmit={handleDispatch} onMouseDown={e => e.stopPropagation()}>
            <button type="button" className="close" onClick={() => setOpenDispatchModal(false)}>
              <X size={18}/>
            </button>
            <span className="kicker">DISPATCH TO HIRED AGENT</span>
            <h2>Queue an Engineering Issue</h2>
            <p>Select which of your hired agents will investigate, apply patches, and run tests.</p>

            <label>
              Select Hired Agent
              <select
                value={selectedAgentForDispatch}
                onChange={e => setSelectedAgentForDispatch(e.target.value)}
              >
                {mySubscriptions.map(sub => (
                  <option key={sub.agentSlug} value={sub.agentSlug}>
                    {sub.agentName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Repository (Owner/Name)
              <input
                value={form.repository}
                onChange={e => setForm({ ...form, repository: e.target.value })}
                required
              />
            </label>

            <label>
              Issue Number
              <input
                type="number"
                min="1"
                value={form.issueNumber}
                onChange={e => setForm({ ...form, issueNumber: e.target.value })}
                required
              />
            </label>

            <label>
              Issue Title / Bug Description
              <input
                value={form.issueTitle}
                onChange={e => setForm({ ...form, issueTitle: e.target.value })}
                required
              />
            </label>

            <button className="primary full" type="submit">
              Dispatch to Isolated Worker <ArrowRight size={17}/>
            </button>
          </form>
        </div>
      )}
    </main>
  )
}

export default App
