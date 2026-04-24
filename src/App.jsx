import { useEffect, useMemo, useRef, useState } from "react";
import {
  exportDataset,
  getAlerts,
  getDashboard,
  getDatasets,
  getTaskDetails,
  getTasks,
  getUsers,
  loginAdmin,
  updateConfig,
  updateUserStatus,
  uploadTasks,
} from "./api/admin";
import { API_BASE_URL, TOKEN_KEY, USER_KEY, getApiError } from "./api/client";
import { Icons } from "./components/Icons";

const NAV_ITEMS = [
  {
    id: "dashboard",
    label: "Vue d'ensemble",
    detail: "Pilotage temps reel",
    icon: Icons.ChartLineUp,
  },
  {
    id: "users",
    label: "Utilisateurs",
    detail: "Comptes et confiance",
    icon: Icons.UsersThree,
  },
  {
    id: "tasks",
    label: "Taches",
    detail: "Suivi des campagnes",
    icon: Icons.List,
  },
  {
    id: "alerts",
    label: "Alertes",
    detail: "Fraude et qualite",
    icon: Icons.BellRinging,
  },
  {
    id: "upload",
    label: "Campagnes",
    detail: "Upload de taches",
    icon: Icons.CloudArrowUp,
  },
  {
    id: "datasets",
    label: "Datasets",
    detail: "Exports valides",
    icon: Icons.Database,
  },
  {
    id: "config",
    label: "Configuration",
    detail: "Regles systeme",
    icon: Icons.GearSix,
  },
];

const PREVIEWS = [
  "/previews/mobile-dashboard.jpeg",
  "/previews/mobile-task.jpeg",
  "/previews/mobile-register.jpeg",
  "/previews/mobile-login.jpeg",
];

const LOGO_SRC = "/logo/DataLoop3.png";
const API_DOCS_URL = "https://dataloop-production.up.railway.app/api/documentation";

const DEFAULT_CONFIG = {
  seuil_consensus: 66,
  freq_sentinelle: 10,
};

const STATUS_LABELS = {
  actif: "Actif",
  suspendu: "Suspendu",
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  terminee: "Terminee",
};

function readSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);

  if (!token || !rawUser) return null;

  try {
    const user = JSON.parse(rawUser);
    return user?.role === "admin" ? { token, user } : null;
  } catch {
    return null;
  }
}

function saveSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("fr-FR").format(number);
}

function formatMoney(value) {
  return `${formatNumber(value)} FCFA`;
}

function formatDate(value) {
  if (!value) return "Non renseigne";

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizePage(payload) {
  return {
    rows: Array.isArray(payload?.data) ? payload.data : [],
    links: payload?.links || {},
    meta: payload?.meta || {},
  };
}

function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function Surface({ children, className = "" }) {
  return (
    <section className={`surface-shell ${className}`}>
      <div className="surface-core">{children}</div>
    </section>
  );
}

function InlineMessage({ tone = "info", children }) {
  return (
    <div className={`inline-message ${tone}`}>
      {tone === "error" ? (
        <Icons.WarningCircle size={18} weight="duotone" />
      ) : (
        <Icons.CheckCircle size={18} weight="duotone" />
      )}
      <span>{children}</span>
    </div>
  );
}

function EmptyState({ title, body, icon: Icon = Icons.Database }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} weight="duotone" />
      </div>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

function SkeletonRows({ count = 5 }) {
  return (
    <div className="skeleton-stack" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

function BrandLockup({ compact = false, inverse = false }) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""} ${inverse ? "inverse" : ""}`}>
      <span className="brand-logo-wrap">
        <img src={LOGO_SRC} alt="DataLoop" />
      </span>
      <span className="brand-admin-label">Admin</span>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(() => readSession());
  const [activeView, setActiveView] = useState("dashboard");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    const handleAuthError = () => {
      clearSession();
      setSession(null);
      setAuthNotice("Session expiree. Connecte-toi a nouveau.");
    };

    window.addEventListener("dataloop:auth-error", handleAuthError);
    return () => window.removeEventListener("dataloop:auth-error", handleAuthError);
  }, []);

  async function handleLogin(credentials) {
    const data = await loginAdmin(credentials);
    saveSession(data);
    setSession({ token: data.access_token, user: data.user });
    setAuthNotice("");
    setActiveView("dashboard");
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setAuthNotice("Tu as ete deconnecte.");
  }

  if (!session) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <AdminShell
      activeView={activeView}
      onNavigate={setActiveView}
      onLogout={handleLogout}
      user={session.user}
    />
  );
}

function LoginScreen({ notice, onLogin }) {
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await onLogin({ telephone, password });
    } catch (caughtError) {
      setError(caughtError.message || getApiError(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-panel">
        <BrandLockup />

        <div className="login-copy">
          <p className="eyebrow">Portail administrateur</p>
          <h1>Controle des campagnes et des donnees validees.</h1>
          <p>
            Connecte-toi avec un compte administrateur pour piloter les taches,
            surveiller la qualite et exporter les datasets.
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {notice ? <InlineMessage>{notice}</InlineMessage> : null}
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <label className="field">
            <span>Numero de telephone</span>
            <input
              autoComplete="tel"
              inputMode="tel"
              onChange={(event) => setTelephone(event.target.value)}
              placeholder="+2250700000000"
              required
              type="tel"
              value={telephone}
            />
          </label>

          <label className="field">
            <span>Mot de passe</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mot de passe admin"
              required
              type="password"
              value={password}
            />
          </label>

          <button className="primary-button" disabled={submitting} type="submit">
            <span>{submitting ? "Connexion..." : "Se connecter"}</span>
            <span className="button-icon">
              <Icons.ArrowRight size={17} weight="bold" />
            </span>
          </button>
        </form>
      </div>

      <aside className="login-visual" aria-label="Apercu mobile DataLoop">
        <div className="hero-logo-card">
          <img src={LOGO_SRC} alt="Logo DataLoop" />
        </div>
        <div className="phone-stack">
          <img className="phone-shot shot-main" src="/previews/mobile-dashboard.jpeg" alt="Apercu mobile DataLoop dashboard" />
          <img className="phone-shot shot-back" src="/previews/mobile-task.jpeg" alt="Apercu mobile DataLoop taches" />
        </div>
        <div className="login-proof-grid" aria-label="Capacites du portail">
          <span>Fraude</span>
          <span>Campagnes</span>
          <span>Exports</span>
        </div>
        <div className="api-pill">
          <span className="status-dot" />
          <span>{API_BASE_URL.replace("https://", "")}</span>
        </div>
      </aside>
    </main>
  );
}

function AdminShell({ activeView, onNavigate, onLogout, user }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [userSearchKey, setUserSearchKey] = useState("");
  const activeItem = NAV_ITEMS.find((item) => item.id === activeView) || NAV_ITEMS[0];

  function navigate(view) {
    onNavigate(view);
    setMobileNavOpen(false);
  }

  const content = {
    dashboard: <DashboardPage onNavigate={onNavigate} />,
    users: <UsersPage initialSearch={userSearchKey} onResetSearch={() => setUserSearchKey("")} />,
    alerts: (
      <AlertsPage
        onOpenUser={(telephone) => {
          setUserSearchKey(telephone || "");
          navigate("users");
        }}
      />
    ),
    upload: <UploadPage />,
    tasks: <TasksPage />,
    datasets: <DatasetsPage />,
    config: <ConfigPage />,
  }[activeView];

  return (
    <div className="admin-shell">
      <a className="skip-link" href="#workspace-content">
        Aller au contenu
      </a>
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="sidebar-top">
          <BrandLockup compact inverse />
          <button
            aria-label="Fermer la navigation"
            className="icon-button mobile-only"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          >
            <Icons.X size={18} />
          </button>
        </div>

        <div className="sidebar-scroll">
          <nav className="sidebar-nav" aria-label="Navigation admin">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeView;

              return (
                <button
                  className={`nav-item ${isActive ? "active" : ""}`}
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  type="button"
                >
                  <Icon size={20} weight={isActive ? "duotone" : "regular"} />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-card">
            <span className="mini-label">Connexion API</span>
            <strong>{API_BASE_URL.replace("https://", "")}</strong>
            <a href={API_DOCS_URL} rel="noreferrer" target="_blank">
              Documentation
              <Icons.ArrowRight size={13} weight="bold" />
            </a>
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">
              <Icons.UserCircle size={28} weight="duotone" />
            </div>
            <div>
              <strong>{user?.name || "Admin DataLoop"}</strong>
              <small>{user?.telephone || "Compte administrateur"}</small>
            </div>
            <button aria-label="Deconnexion" className="icon-button" onClick={onLogout} type="button">
              <Icons.SignOut size={18} />
            </button>
          </div>
          <div className="sidebar-foot">
            <span>DataLoop Admin</span>
            <span>v0.1</span>
          </div>
        </div>
      </aside>

      <main className="workspace" id="workspace-content">
        <header className="workspace-header">
          <button
            aria-label="Ouvrir la navigation"
            className="icon-button mobile-only"
            onClick={() => setMobileNavOpen(true)}
            type="button"
          >
            <Icons.List size={20} />
          </button>
          <div>
            <p className="eyebrow">{activeItem.detail}</p>
            <h1>{activeItem.label}</h1>
          </div>
          <div className="header-status" aria-label="Statut de connexion">
            <span className="status-dot" />
            <span>Session admin</span>
          </div>
          <button className="ghost-button" onClick={onLogout} type="button">
            <Icons.SignOut size={17} />
            <span>Quitter</span>
          </button>
        </header>

        <div className="page-content" key={activeView}>
          {content}
        </div>
      </main>
    </div>
  );
}

function DashboardPage({ onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [pendingTasks, setPendingTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [dashboardPayload, alertsPayload, tasksPayload] = await Promise.all([
        getDashboard(),
        getAlerts({ severity: "high" }),
        getTasks({ status: "en_cours", per_page: 1 }),
      ]);
      setMetrics(dashboardPayload?.data || {});
      setAlerts(alertsPayload?.alerts || []);
      setPendingTasks(Number(tasksPayload?.meta?.total || 0));
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <SkeletonRows count={6} />;
  }

  if (error) {
    return (
      <Surface>
        <InlineMessage tone="error">{error}</InlineMessage>
        <button className="secondary-button" onClick={loadDashboard} type="button">
          <Icons.ArrowClockwise size={17} />
          Recharger
        </button>
      </Surface>
    );
  }

  return (
    <div className="dashboard-stack">
      <div className="intro-actions">
        <button className="cta-button" onClick={() => onNavigate("upload")} type="button">
          <Icons.CloudArrowUp size={17} weight="bold" />
          Nouvelle campagne
        </button>
        <button className="secondary-button" onClick={() => onNavigate("datasets")} type="button">
          <Icons.Database size={17} />
          Exports
        </button>
      </div>

      <div className="dashboard-grid">
      <Surface className="metric-card metric-large">
        <div className="metric-head">
          <Icons.Activity size={22} weight="duotone" />
          <span>Aujourd'hui</span>
        </div>
        <strong>{formatNumber(metrics?.annotations_aujourdhui)}</strong>
        <p>Annotations traitees depuis le debut de la journee.</p>
      </Surface>

      <Surface className="metric-card">
        <div className="metric-head">
          <Icons.UsersThree size={22} weight="duotone" />
          <span>Utilisateurs</span>
        </div>
        <strong>{formatNumber(metrics?.utilisateurs_inscrits)}</strong>
        <p>Comptes inscrits sur la plateforme mobile.</p>
      </Surface>

      <Surface className="metric-card accent">
        <div className="metric-head">
          <Icons.Money size={22} weight="duotone" />
          <span>Recompenses</span>
        </div>
        <strong>{formatMoney(metrics?.solde_total_distribue)}</strong>
        <p>Montant total distribue aux contributeurs.</p>
      </Surface>

      <Surface className="metric-card">
        <div className="metric-head">
          <Icons.Image size={22} weight="duotone" />
          <span>Taches en cours</span>
        </div>
        <strong>{formatNumber(pendingTasks)}</strong>
        <p>En attente de consensus communautaire.</p>
      </Surface>

      <Surface className="quality-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Controle qualite</p>
            <h2>Alertes rapides</h2>
          </div>
          <span className="count-pill">{alerts.length} signaux</span>
        </div>

        {alerts.length ? (
          <div className="alert-list compact-list">
            {alerts.slice(0, 5).map((alert) => (
              <article className="compact-row" key={alert.id}>
                <div>
                  <strong>{alert.utilisateur?.name || "Utilisateur"}</strong>
                  <small>{alert.reason}</small>
                </div>
                <span className="danger-text">{formatNumber(alert.temps_execution_ms)} ms</span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            body="Aucune execution suspecte remontee sur la fenetre active."
            icon={Icons.ShieldCheck}
            title="Qualite stable"
          />
        )}
      </Surface>

      <Surface className="operations-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Operations</p>
            <h2>Actions prioritaires</h2>
          </div>
        </div>
        <div className="quick-action-grid">
          <QuickAction
            body="Ajouter des images, une question et les options de reponse."
            icon={Icons.CloudArrowUp}
            label="Creer une campagne"
            onClick={() => onNavigate("upload")}
          />
          <QuickAction
            body="Verifier les temps d'execution anormalement bas."
            icon={Icons.BellRinging}
            label="Analyser les alertes"
            onClick={() => onNavigate("alerts")}
          />
          <QuickAction
            body="Recuperer les datasets valides au format CSV ou JSON."
            icon={Icons.ArrowLineDown}
            label="Exporter les donnees"
            onClick={() => onNavigate("datasets")}
          />
        </div>
      </Surface>

      <Surface className="mobile-context">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Produit mobile</p>
            <h2>Experience contributeur</h2>
          </div>
        </div>
        <div className="preview-strip">
          {PREVIEWS.map((src, index) => (
            <img
              alt={`Apercu mobile DataLoop ${index + 1}`}
              key={src}
              src={src}
              style={{ "--index": index }}
            />
          ))}
        </div>
      </Surface>
      </div>
    </div>
  );
}

function TasksPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pageData = useMemo(() => normalizePage(payload), [payload]);

  useEffect(() => {
    async function loadTasks() {
      setLoading(true);
      setError("");

      try {
        const params = { page, per_page: 12 };
        if (status) params.status = status;
        setPayload(await getTasks(params));
      } catch (caughtError) {
        setError(getApiError(caughtError));
      } finally {
        setLoading(false);
      }
    }

    loadTasks();
  }, [page, status]);

  return (
    <div className="stack">
      <Surface>
        <div className="toolbar">
          <select
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="">Tous les statuts</option>
            <option value="nouvelle">Nouvelle</option>
            <option value="en_cours">En cours</option>
            <option value="terminee">Terminee</option>
          </select>
        </div>

        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        {loading ? (
          <SkeletonRows />
        ) : pageData.rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Question</th>
                    <th>Type</th>
                    <th>Progression</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.rows.map((task) => {
                    const imageUrl = task.image?.url || task.image?.url_stockage;

                    return (
                      <tr key={task.id}>
                        <td>
                          {imageUrl ? (
                            <img alt="Tache" className="task-thumb" src={imageUrl} />
                          ) : (
                            <span className="task-thumb-empty">
                              <Icons.Image size={18} />
                            </span>
                          )}
                        </td>
                        <td className="question-cell">
                          <strong>{task.question || "Question non renseignee"}</strong>
                        </td>
                        <td>{task.type_tache || "Non renseigne"}</td>
                        <td>
                          {formatNumber(task.annotations_count)} / {formatNumber(task.nb_annotations_requises)}
                        </td>
                        <td>
                          <StatusBadge status={task.statut} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination meta={pageData.meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            body="Aucune tache ne correspond aux filtres actuels."
            icon={Icons.List}
            title="Aucune tache"
          />
        )}
      </Surface>
    </div>
  );
}

function QuickAction({ body, icon: Icon, label, onClick }) {
  return (
    <button className="quick-action" onClick={onClick} type="button">
      <span>
        <Icon size={20} weight="duotone" />
      </span>
      <strong>{label}</strong>
      <small>{body}</small>
    </button>
  );
}

function UsersPage({ initialSearch = "", onResetSearch }) {
  const [search, setSearch] = useState(initialSearch);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("latest");
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [motif, setMotif] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const debouncedSearch = useDebouncedValue(search);

  const pageData = useMemo(() => normalizePage(payload), [payload]);

  useEffect(() => {
    if (!initialSearch) return;
    setSearch(initialSearch);
    onResetSearch?.();
  }, [initialSearch, onResetSearch]);

  async function loadUsers() {
    setLoading(true);
    setError("");

    try {
      const params = {
        page,
        per_page: 12,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (status) params.status = status;
      if (sort === "score") params.sort = "score";

      setPayload(await getUsers(params));
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [page, debouncedSearch, status, sort]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort]);

  async function submitStatusUpdate(event) {
    event.preventDefault();
    if (!selectedUser) return;

    const nextStatus = selectedUser.statut === "suspendu" ? "actif" : "suspendu";
    setSaving(true);
    setError("");
    setNotice("");

    try {
      await updateUserStatus(selectedUser.id, {
        statut: nextStatus,
        motif: motif || null,
      });
      setSelectedUser(null);
      setMotif("");
      setNotice(`Statut mis a jour pour ${selectedUser.name || "cet utilisateur"}.`);
      await loadUsers();
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <Surface>
        <div className="toolbar">
          <label className="search-box">
            <Icons.MagnifyingGlass size={18} />
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, telephone ou email"
              type="search"
              value={search}
            />
          </label>

          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="suspendu">Suspendus</option>
          </select>

          <button
            className={`segmented-button ${sort === "score" ? "active" : ""}`}
            onClick={() => setSort(sort === "score" ? "latest" : "score")}
            type="button"
          >
            <Icons.SlidersHorizontal size={17} />
            Score
          </button>
        </div>

        {notice ? <InlineMessage>{notice}</InlineMessage> : null}
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        {loading ? (
          <SkeletonRows />
        ) : pageData.rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Telephone</th>
                    <th>Score</th>
                    <th>Solde</th>
                    <th>Statut</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.rows.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div className="identity-cell">
                          <span>{(user.name || "?").slice(0, 2).toUpperCase()}</span>
                          <div>
                            <strong>{user.name || "Sans nom"}</strong>
                            <small>{user.email || "Email non renseigne"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{user.telephone || "Non renseigne"}</td>
                      <td>
                        <ScoreBadge value={user.score_confiance} />
                      </td>
                      <td>{formatMoney(user.solde_virtuel)}</td>
                      <td>
                        <StatusBadge status={user.statut} />
                      </td>
                      <td>
                        <button
                          className="small-action"
                          onClick={() => {
                            setSelectedUser(user);
                            setMotif("");
                          }}
                          type="button"
                        >
                          {user.statut === "suspendu" ? "Reactiver" : "Suspendre"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={pageData.meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            body="Aucun contributeur ne correspond aux filtres actuels."
            icon={Icons.UsersThree}
            title="Aucun utilisateur"
          />
        )}
      </Surface>

      {selectedUser ? (
        <Modal onClose={() => setSelectedUser(null)} title="Modifier le statut">
          <form className="modal-form" onSubmit={submitStatusUpdate}>
            <p>
              {selectedUser.statut === "suspendu"
                ? "Le compte sera reactive."
                : "Le compte sera suspendu et le motif restera disponible pour le suivi."}
            </p>
            <label className="field">
              <span>Motif</span>
              <textarea
                onChange={(event) => setMotif(event.target.value)}
                placeholder="Suspicion de fraude, comportement repetitif, litige..."
                rows={4}
                value={motif}
              />
            </label>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setSelectedUser(null)} type="button">
                Annuler
              </button>
              <button className="primary-button compact" disabled={saving} type="submit">
                <span>{saving ? "Traitement..." : "Valider"}</span>
                <span className="button-icon">
                  <Icons.CheckCircle size={16} weight="bold" />
                </span>
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function AlertsPage({ onOpenUser }) {
  const [severity, setSeverity] = useState("high");
  const [resolved, setResolved] = useState(false);
  const [payload, setPayload] = useState({ alerts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskPreviewId, setTaskPreviewId] = useState(null);
  const [taskPreview, setTaskPreview] = useState(null);
  const [taskPreviewLoading, setTaskPreviewLoading] = useState(false);
  const [taskPreviewError, setTaskPreviewError] = useState("");

  async function loadAlerts() {
    setLoading(true);
    setError("");

    try {
      setPayload(await getAlerts({ severity, resolved }));
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [severity, resolved]);

  async function openTaskPreview(taskId) {
    if (!taskId) return;

    setTaskPreviewId(taskId);
    setTaskPreview(null);
    setTaskPreviewError("");
    setTaskPreviewLoading(true);

    try {
      setTaskPreview(await getTaskDetails(taskId));
    } catch (caughtError) {
      setTaskPreviewError(getApiError(caughtError));
    } finally {
      setTaskPreviewLoading(false);
    }
  }

  function closeTaskPreview() {
    setTaskPreviewId(null);
    setTaskPreview(null);
    setTaskPreviewError("");
    setTaskPreviewLoading(false);
  }

  const alerts = payload?.alerts || [];

  return (
    <div className="stack">
      <Surface>
        <div className="toolbar">
          <div className="segmented-control">
            <button
              className={severity === "high" ? "active" : ""}
              onClick={() => setSeverity("high")}
              type="button"
            >
              Haute severite
            </button>
            <button
              className={severity === "medium" ? "active" : ""}
              onClick={() => setSeverity("medium")}
              type="button"
            >
              Surveillance
            </button>
          </div>

          <label className="toggle-line">
            <input
              checked={resolved}
              onChange={(event) => setResolved(event.target.checked)}
              type="checkbox"
            />
            <span>Inclure l'historique</span>
          </label>
        </div>

        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        {loading ? (
          <SkeletonRows />
        ) : alerts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Utilisateur</th>
                  <th>Tache</th>
                  <th>Temps</th>
                  <th>Severite</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const taskId = alert.tache_id || alert.tache?.id;

                  return (
                    <tr key={alert.id}>
                      <td>{formatDate(alert.created_at)}</td>
                      <td>
                        <div className="identity-inline">
                          <strong>{alert.utilisateur?.name || "Utilisateur"}</strong>
                          <small>{alert.utilisateur?.telephone || "Non renseigne"}</small>
                        </div>
                      </td>
                      <td className="question-cell">{alert.tache?.question || "Question non renseignee"}</td>
                      <td className="danger-text">{formatNumber(alert.temps_execution_ms)} ms</td>
                      <td>
                        <SeverityBadge severity={alert.severity || severity} />
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="small-action"
                            onClick={() => onOpenUser(alert.utilisateur?.telephone || "")}
                            type="button"
                          >
                            Voir profil
                          </button>
                          <button
                            className="small-action"
                            disabled={!taskId}
                            onClick={() => openTaskPreview(taskId)}
                            type="button"
                          >
                            Voir tache
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            body="Aucune annotation suspecte ne correspond au filtre actuel."
            icon={Icons.ShieldCheck}
            title="Aucune alerte"
          />
        )}
      </Surface>

      {taskPreviewId ? (
        <Modal className="task-preview-card" onClose={closeTaskPreview} title={`Tache #${taskPreviewId}`}>
          <div className="modal-form">
            {taskPreviewLoading ? (
              <SkeletonRows count={3} />
            ) : taskPreviewError ? (
              <InlineMessage tone="error">{taskPreviewError}</InlineMessage>
            ) : taskPreview ? (
              <div className="task-preview-layout">
                {taskPreview.image?.url || taskPreview.image?.url_stockage ? (
                  <img
                    alt="Illustration de la tache"
                    className="task-preview-image"
                    src={taskPreview.image?.url || taskPreview.image?.url_stockage}
                  />
                ) : (
                  <div className="task-preview-placeholder">
                    <Icons.Image size={26} />
                    <span>Image indisponible</span>
                  </div>
                )}

                <div className="task-preview-meta">
                  <h3>{taskPreview.question || "Question non renseignee"}</h3>
                  <div className="task-preview-status">
                    <StatusBadge status={taskPreview.statut} />
                    <span className="count-pill">
                      {formatNumber(taskPreview.annotations_count)} /{" "}
                      {formatNumber(taskPreview.nb_annotations_requises)} avis
                    </span>
                  </div>
                  <div className="task-preview-facts">
                    <small>Type: {taskPreview.type_tache || "Non renseigne"}</small>
                    {taskPreview.options_reponse?.length ? (
                      <small>Options: {taskPreview.options_reponse.join(", ")}</small>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                body="Impossible de charger les details de cette tache."
                icon={Icons.Image}
                title="Tache introuvable"
              />
            )}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function UploadPage() {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [typeTache, setTypeTache] = useState("classification_image");
  const [question, setQuestion] = useState("Que montre cette image ?");
  const [options, setOptions] = useState(["Commerce", "Route", "Document"]);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const valid = incoming.filter((file) => {
      const isImage = file.type.startsWith("image/");
      const isSmallEnough = file.size <= 8 * 1024 * 1024;
      return isImage && isSmallEnough;
    });

    if (valid.length !== incoming.length) {
      setError("Certaines images ont ete ignorees: format image requis et limite de 8 MB.");
    }

    setFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}`));
      const deduped = valid.filter((file) => !existing.has(`${file.name}-${file.size}`));
      return [...current, ...deduped];
    });
  }

  function updateOption(index, value) {
    setOptions((current) => current.map((option, optionIndex) => (optionIndex === index ? value : option)));
  }

  function removeOption(index) {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  }

  async function submitUpload(event) {
    event.preventDefault();
    setError("");
    setResult("");

    const cleanOptions = options.map((option) => option.trim()).filter(Boolean);

    if (!files.length) {
      setError("Ajoute au moins une image avant de lancer la campagne.");
      return;
    }

    if (!typeTache.trim() || !question.trim()) {
      setError("Le type de tache et la question sont obligatoires.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("images[]", file));
    formData.append("type_tache", typeTache.trim());
    formData.append("question", question.trim());
    cleanOptions.forEach((option) => formData.append("options[]", option));

    setSubmitting(true);
    setProgress(0);

    try {
      const response = await uploadTasks(formData, (eventProgress) => {
        if (!eventProgress.total) return;
        setProgress(Math.round((eventProgress.loaded * 100) / eventProgress.total));
      });
      setFiles([]);
      setResult(`${response.count || 0} tache(s) creee(s) avec succes.`);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack">
      <div className="upload-grid">
        <Surface>
        <form className="upload-form" onSubmit={submitUpload}>
          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragging(false);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            role="button"
            tabIndex={0}
          >
            <input
              accept="image/*"
              multiple
              onChange={(event) => addFiles(event.target.files)}
              ref={inputRef}
              type="file"
            />
            <Icons.CloudArrowUp size={34} weight="duotone" />
            <strong>Deposer les images de campagne</strong>
            <p>Selection multiple acceptee, limite 8 MB par image.</p>
          </div>

          {files.length ? (
            <div className="file-list">
              {files.map((file) => (
                <div className="file-chip" key={`${file.name}-${file.size}`}>
                  <Icons.Image size={16} />
                  <span>{file.name}</span>
                  <button
                    aria-label={`Retirer ${file.name}`}
                    onClick={() => setFiles((current) => current.filter((item) => item !== file))}
                    type="button"
                  >
                    <Icons.X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="form-grid">
            <label className="field">
              <span>Type de tache</span>
              <input onChange={(event) => setTypeTache(event.target.value)} value={typeTache} />
            </label>

            <label className="field">
              <span>Question</span>
              <input onChange={(event) => setQuestion(event.target.value)} value={question} />
            </label>
          </div>

          <div className="options-block">
            <div className="section-heading inline">
              <div>
                <p className="eyebrow">Reponses</p>
                <h2>Options proposees</h2>
              </div>
              <button
                className="secondary-button compact"
                onClick={() => setOptions((current) => [...current, ""])}
                type="button"
              >
                Ajouter
              </button>
            </div>
            {options.map((option, index) => (
              <div className="option-row" key={index}>
                <input
                  onChange={(event) => updateOption(index, event.target.value)}
                  placeholder={`Option ${index + 1}`}
                  value={option}
                />
                <button
                  aria-label="Retirer cette option"
                  className="icon-button"
                  disabled={options.length <= 1}
                  onClick={() => removeOption(index)}
                  type="button"
                >
                  <Icons.X size={15} />
                </button>
              </div>
            ))}
          </div>

          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
          {result ? <InlineMessage>{result}</InlineMessage> : null}

          {submitting ? (
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          <button className="cta-button submit-button" disabled={submitting} type="submit">
            <span>{submitting ? `Upload ${progress}%` : "Creer la campagne"}</span>
            <span className="button-icon">
              <Icons.ArrowRight size={17} weight="bold" />
            </span>
          </button>
        </form>
        </Surface>

        <Surface className="campaign-preview">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Apercu terrain</p>
            <h2>La tache apparaitra dans le flux mobile.</h2>
          </div>
        </div>
        <img src="/previews/mobile-task.jpeg" alt="Apercu mobile de tache DataLoop" />
        </Surface>
      </div>
    </div>
  );
}

function DatasetsPage() {
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState("");
  const pageData = useMemo(() => normalizePage(payload), [payload]);

  async function loadDatasets() {
    setLoading(true);
    setError("");

    try {
      setPayload(await getDatasets({ page, per_page: 12 }));
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDatasets();
  }, [page]);

  async function handleExport(dataset, format) {
    const key = `${dataset.id}-${format}`;
    setDownloading(key);
    setError("");

    try {
      const blob = await exportDataset(dataset.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dataset_${dataset.id}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setDownloading("");
    }
  }

  return (
    <div className="stack">
      <Surface>
        {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

        {loading ? (
          <SkeletonRows />
        ) : pageData.rows.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Version</th>
                    <th>Images</th>
                    <th>Annotations</th>
                    <th>Date</th>
                    <th>Exports</th>
                  </tr>
                </thead>
                <tbody>
                  {pageData.rows.map((dataset) => (
                    <tr key={dataset.id}>
                      <td>
                        <div className="identity-inline">
                          <strong>{dataset.nom || `Dataset ${dataset.id}`}</strong>
                          <small>{dataset.description || "Consensus communautaire"}</small>
                        </div>
                      </td>
                      <td>{dataset.version || "1.0"}</td>
                      <td>{formatNumber(dataset.nb_images)}</td>
                      <td>{formatNumber(dataset.nb_annotations_validees || dataset.annotations_count)}</td>
                      <td>{formatDate(dataset.created_at)}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="small-action export-action"
                            disabled={downloading === `${dataset.id}-csv`}
                            onClick={() => handleExport(dataset, "csv")}
                            type="button"
                          >
                            <Icons.DownloadSimple size={15} />
                            CSV
                          </button>
                          <button
                            className="small-action export-action"
                            disabled={downloading === `${dataset.id}-json`}
                            onClick={() => handleExport(dataset, "json")}
                            type="button"
                          >
                            <Icons.DownloadSimple size={15} />
                            JSON
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={pageData.meta} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            body="Aucun dataset genere n'est disponible pour le moment."
            icon={Icons.Database}
            title="Aucun export"
          />
        )}
      </Surface>
    </div>
  );
}

function ConfigPage() {
  const [values, setValues] = useState(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submitConfig(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await updateConfig({
        seuil_consensus: Number(values.seuil_consensus),
        freq_sentinelle: Number(values.freq_sentinelle),
      });
      setValues((current) => ({ ...current, ...(response.config || {}) }));
      setMessage(response.message || "Configuration mise a jour.");
    } catch (caughtError) {
      setError(getApiError(caughtError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <div className="config-grid">
        <Surface>
        <form className="config-form" onSubmit={submitConfig}>
          <label className="field range-field">
            <span>Seuil de consensus</span>
            <strong>{values.seuil_consensus}%</strong>
            <input
              max="100"
              min="0"
              onChange={(event) =>
                setValues((current) => ({ ...current, seuil_consensus: event.target.value }))
              }
              type="range"
              value={values.seuil_consensus}
            />
          </label>

          <label className="field">
            <span>Frequence sentinelle</span>
            <input
              min="0"
              onChange={(event) =>
                setValues((current) => ({ ...current, freq_sentinelle: event.target.value }))
              }
              type="number"
              value={values.freq_sentinelle}
            />
            <small>Nombre de taches avant l'apparition d'une tache de controle.</small>
          </label>

          {message ? <InlineMessage>{message}</InlineMessage> : null}
          {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}

          <button className="primary-button" disabled={saving} type="submit">
            <span>{saving ? "Sauvegarde..." : "Sauvegarder"}</span>
            <span className="button-icon">
              <Icons.CheckCircle size={17} weight="bold" />
            </span>
          </button>
        </form>
        </Surface>

        <Surface className="rules-panel">
        <p className="eyebrow">Regles actives</p>
        <div className="rule-readout">
          <span>Consensus</span>
          <strong>{values.seuil_consensus}%</strong>
        </div>
        <div className="rule-readout">
          <span>Sentinelle</span>
          <strong>1 / {values.freq_sentinelle || 0}</strong>
        </div>
        <p className="muted">
          Ces reglages influencent la validation des taches et la frequence des controles.
        </p>
        </Surface>
      </div>
    </div>
  );
}

function ScoreBadge({ value }) {
  const score = Number(value || 0);
  const tone = score >= 80 ? "good" : score >= 50 ? "warn" : "bad";

  return <span className={`score-badge ${tone}`}>{score.toFixed(1)}</span>;
}

function StatusBadge({ status }) {
  const normalized = String(status || "actif").toLowerCase();
  const label = STATUS_LABELS[normalized] || normalized.replaceAll("_", " ");
  return <span className={`status-badge ${normalized}`}>{label}</span>;
}

function SeverityBadge({ severity }) {
  return <span className={`severity-badge ${severity}`}>{severity === "high" ? "Haute" : "Moyenne"}</span>;
}

function Pagination({ meta, onPage }) {
  const current = Number(meta?.current_page || 1);
  const last = Number(meta?.last_page || 1);
  const total = Number(meta?.total || 0);

  return (
    <div className="pagination">
      <span>
        Page {current} sur {last} · {formatNumber(total)} element(s)
      </span>
      <div>
        <button disabled={current <= 1} onClick={() => onPage(current - 1)} type="button">
          Precedent
        </button>
        <button disabled={current >= last} onClick={() => onPage(current + 1)} type="button">
          Suivant
        </button>
      </div>
    </div>
  );
}

function Modal({ children, className = "", onClose, title }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className={`modal-card ${className}`.trim()} role="dialog">
        <div className="modal-header">
          <h2>{title}</h2>
          <button aria-label="Fermer" className="icon-button" onClick={onClose} type="button">
            <Icons.X size={17} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export default App;
