/* ============================================================
   PRAXIS — app.js
   Full Library engine: data-driven folders, real upload,
   localStorage persistence, search, subject-picker modal
   ============================================================ */

// ── SUBJECTS CONFIG ─────────────────────────────────────────
const SUBJECTS_CONFIG = {
  maths: { name: 'Mathématiques', icon: '📐', gradient: 'linear-gradient(135deg,#4E6AFF,#818CF8)', mastery: 78 },
  physique: { name: 'Physique-Chimie', icon: '🧲', gradient: 'linear-gradient(135deg,#06B6D4,#0EA5E9)', mastery: 55 },
  philo: { name: 'Philosophie', icon: 'φ', gradient: 'linear-gradient(135deg,#A855F7,#EC4899)', mastery: 30 },
  info: { name: 'Informatique', icon: '</>', gradient: 'linear-gradient(135deg,#22C55E,#16A34A)', mastery: 20 },
};

// ── DEFAULT SEED FILES ───────────────────────────────────────
// Pre-filled so the library isn't empty on first open
const DEFAULT_FILES = {
  maths: [
    { name: 'Cours_Analyse_CH3.pdf', size: 2411724, date: '2026-01-18' },
    { name: 'TD_Geometrie_Vect.pdf', size: 1153433, date: '2026-01-12' },
    { name: 'Exercices_Integr.pdf', size: 1003520, date: '2026-01-05' },
    { name: 'Suites_et_Series.pdf', size: 1748019, date: '2026-01-22' },
    { name: 'Denombrement_CH1.pdf', size: 988672, date: '2026-01-03' },
    { name: 'Algebre_Lin_CH4.pdf', size: 2097152, date: '2026-01-29' },
    { name: 'Topologie_R.pdf', size: 1258291, date: '2026-02-01' },
    { name: 'Probabilites_CH2.pdf', size: 1572864, date: '2026-02-05' },
    { name: 'Equations_Diff.pdf', size: 900000, date: '2026-02-10' },
  ],
  physique: [
    { name: 'Thermo_CH2_Cycles.pdf', size: 3355443, date: '2026-01-20' },
    { name: 'Optique_Geometrique.pdf', size: 1887436, date: '2026-01-10' },
    { name: 'Electromag_CH1.pdf', size: 2621440, date: '2026-01-15' },
    { name: 'Mecanique_Fluides.pdf', size: 1835008, date: '2026-01-25' },
    { name: 'Chimie_Cinetique.pdf', size: 2097152, date: '2026-02-02' },
    { name: 'Ondes_Oscillations.pdf', size: 1258291, date: '2026-02-08' },
    { name: 'Optique_Ondulatoire.pdf', size: 1048576, date: '2026-02-12' },
  ],
  philo: [
    { name: 'Kant_Critique_Raison.pdf', size: 4718592, date: '2026-01-22' },
    { name: 'Descartes_Meditations.pdf', size: 2202009, date: '2026-01-15' },
    { name: 'Nietzsche_Morale.pdf', size: 1887436, date: '2026-01-08' },
    { name: 'Platon_Republique.pdf', size: 3145728, date: '2026-02-03' },
  ],
  info: [
    { name: 'Algo_Tri_Arbres.pdf', size: 1572864, date: '2026-01-17' },
    { name: 'SQL_BDD_CH2.pdf', size: 1258291, date: '2026-01-28' },
    { name: 'Complexite_Algo.pdf', size: 786432, date: '2026-02-06' },
  ],
};

// ── STATE ─────────────────────────────────────────────────────
let state = {
  subjects: {},    // { id: { name, icon, gradient, mastery, files: [] } },
  openFolders: new Set(['maths']),
  navStack: [],
  sessionErrors: [],
  progression: JSON.parse(localStorage.getItem('praxis_progression')) || {
    xp: 2840,
    level: 1,
    streak: 14,
    lastActionDate: new Date().toISOString().slice(0, 10)
  }
};

// Helpers
function saveState() {
  const s = { subjects: state.subjects, openFolders: [...state.openFolders] };
  try { localStorage.setItem('praxis_lib', JSON.stringify(s)); } catch (e) { }
}
function loadState() {
  try {
    const raw = localStorage.getItem('praxis_lib');
    if (raw) {
      const s = JSON.parse(raw);
      state.subjects = s.subjects || {};
      state.openFolders = new Set(s.openFolders || ['maths']);
      return;
    }
  } catch (e) { }
  // First load — seed with defaults
  for (const [id, cfg] of Object.entries(SUBJECTS_CONFIG)) {
    state.subjects[id] = { ...cfg, files: DEFAULT_FILES[id] || [] };
  }
  saveState();
}

// ── FORMAT HELPERS ───────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' Go';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' Mo';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return bytes + ' o';
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function totalStorage() {
  let total = 0;
  for (const sub of Object.values(state.subjects)) {
    for (const f of sub.files) total += (f.size || 0);
  }
  return fmtSize(total);
}

// --- Navigation & Logic Helpers ---
/**
 * Ouvre le Hub d'une matière spécifique
 * @param {string} subjectId - L'ID de la matière (ex: 'maths')
 */
function openSubjectHub(subjectId) {
  const sub = state.subjects[subjectId];
  if (!sub) return;

  // Mise à jour de l'ID sélectionné pour Library
  Library.selectSubject(subjectId);

  // On enregistre le passage dans la pile pour le bouton retour
  state.navStack = ['grid', 'hub'];

  // Animation de transition
  showToast(`📚 Hub ${sub.name} ouvert`);
}

/**
 * Système de tri chronologique pour les fichiers
 * @param {Array} files - Tableau de fichiers d'une matière
 */
function getSortedFiles(files) {
  return [...files].sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ============================================================
   PRAXIS — Système de Gamification (XP, Levels & Persistence)
   ============================================================ */

const XP_PER_LEVEL = 1000;

const XP_STEP = 1000;

/**
 * Déclenche une explosion de confetti aux couleurs de Praxis
 */
function celebrateLevelUp() {
  // Couleurs Indigo (#6366F1) et Émeraude (#10B981)
  const colors = ['#6366F1', '#10B981', '#4E6AFF', '#22C55E'];

  // Explosion centrale
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: colors,
    disableForReducedMotion: true
  });

  // Petites rafales latérales pour l'effet "Canon"
  const duration = 3 * 1000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: colors
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: colors
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  }());

  // Feedback textuel
  showToast(`🌟 NIVEAU SUPÉRIEUR ATTEINT ! 🌟`);
}

/**
 * Surcharge de la fonction addXP pour détecter le franchissement de palier
 */
function addXP(amount) {
  const oldLevel = Math.floor(state.progression.xp / XP_STEP);
  state.progression.xp += amount;
  const newLevel = Math.floor(state.progression.xp / XP_STEP);

  // Si on change de tranche de 1000 XP
  if (newLevel > oldLevel) {
    state.progression.level = newLevel + 1;
    // Optionnel si tu veux gérer le niveau manuellement
    setTimeout(() => {
      celebrateLevelUp();
    }, 500); // Petit délai pour laisser l'action se terminer
  }

  saveProgression();
  updateXPDisplay();

  if (typeof showXPPopup === 'function') {
    showXPPopup(`+${amount} XP`);
  }
}

/**
 * Déclenche l'XP selon le type d'activité
 */
function gainXPFromAction(actionType) {
  const rewards = {
    'read_summary': 20,
    'complete_flashcards': 100,
    'upload_pdf': 50,
    'daily_login': 150
  };

  const gain = rewards[actionType] || 10;
  addXP(gain);
}

/**
 * Persistence de la progression
 */
function saveProgression() {
  localStorage.setItem('praxis_progression', JSON.stringify(state.progression));
}

/**
 * Mise à jour de l'interface (UI) pour l'XP et les niveaux
 */
function updateXPDisplay() {
  // Mise à jour du texte XP (ex: "2 840 XP")
  const xpValues = document.querySelectorAll('.xp-pill__value');
  xpValues.forEach(el => {
    el.textContent = `${state.progression.xp.toLocaleString()} XP`;
  });

  // Mise à jour du badge XP global (header)
  const headerXP = document.querySelector('.header__xp-text');
  if (headerXP) {
    headerXP.textContent = `${state.progression.xp.toLocaleString()} XP`;
  }

  // Mise à jour du niveau dans le message de bienvenue
  const levelLabel = document.querySelector('.greeting__sub');
  if (levelLabel) {
    const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    levelLabel.textContent = `${today} — Niveau ${state.progression.level}`;
  }

  // Mise à jour de la barre de progression (calcul du % dans le niveau actuel)
  const progressInLevel = state.progression.xp % XP_PER_LEVEL;
  const progressPercent = (progressInLevel / XP_PER_LEVEL) * 100;

  const progressBar = document.querySelector('.streak-progress__fill');
  if (progressBar) {
    progressBar.style.width = `${progressPercent}%`;
  }
}

/* ============================================================
   PRAXIS — Moteur de Contenu IA (Simulation avec aiDatabase)
   ============================================================ */

const aiDatabase = {
  'maths': {
    chapter: "Algèbre Linéaire : Espaces Vectoriels",
    summary: "L'étude des structures vectorielles est le pilier de l'algèbre en prépa. Tout repose sur la notion de combinaison linéaire et de liberté des familles.",
    keyPoints: [
      "Vérifier les 3 axiomes pour montrer qu'un ensemble est un sous-espace vectoriel (SEV).",
      "La dimension d'un espace est le cardinal de n'importe quelle base.",
      "Théorème du rang : dim(E) = dim(ker f) + rg(f)."
    ],
    formula: "dim(F+G) = dim(F) + dim(G) - dim(F ∩ G)",
    warning: "Attention à ne pas confondre 'famille génératrice' (assez de vecteurs) et 'famille libre' (pas de vecteurs de trop) !"
  },
  'physique': {
    chapter: "Électromagnétisme : Équations de Maxwell",
    summary: "Les équations de Maxwell décrivent comment les champs électriques et magnétiques sont générés et modifiés par les charges et les courants.",
    keyPoints: [
      "Maxwell-Gauss : décrit la source du champ E (les charges).",
      "Maxwell-Faraday : montre qu'un champ B variable crée un champ E.",
      "Maxwell-Ampère : montre qu'un courant ou un champ E variable crée un champ B."
    ],
    formula: "∇ · B = 0 (Flux du champ magnétique nul)",
    warning: "N'oubliez jamais le terme de 'courant de déplacement' dans Maxwell-Ampère, c'est l'erreur classique en concours !"
  }
};

const aiExpertDatabase = {
  'maths': {
    chapter: "Espaces Vectoriels & Applications Linéaires",
    context: "Ce chapitre fonde l'algèbre linéaire. L'enjeu est de passer de la vision géométrique (vecteurs du plan) à une vision abstraite (fonctions, suites, matrices) pour résoudre des systèmes complexes.",
    theorems: [
      "<strong>Théorème de la base incomplète :</strong> Dans un EV de dimension finie, toute famille libre peut être complétée en une base.",
      "<strong>Théorème du rang :</strong> Pour f ∈ L(E,F), dim(E) = dim(ker f) + rg(f). C'est l'outil n°1 pour trouver la dimension d'un noyau.",
      "<strong>Caractérisation des isomorphismes :</strong> f est un isomorphisme ssi f transforme une base de E en une base de F."
    ],
    methods: [
      "Pour montrer qu'un ensemble est un SEV, vérifiez toujours la stabilité par combinaison linéaire (λu + v).",
      "Pour déterminer une base de Ker(f), résolvez le système f(x)=0 et exprimez les variables liées en fonction des variables libres.",
      "Utilisez la liberté d'une famille pour prouver l'unicité des coefficients d'une décomposition."
    ],
    errors: [
      "Confondre la dimension de l'espace avec le nombre de vecteurs d'une famille quelconque.",
      "Affirmer que Ker(f) = {0} implique la surjectivité sans vérifier que les espaces de départ et d'arrivée ont la même dimension finie.",
      "Oublier de préciser que l'espace est de dimension finie avant d'appliquer le théorème du rang."
    ]
  },
  'physique': {
    chapter: "Thermodynamique : Cycles & Machines",
    context: "L'enjeu est de modéliser les conversions d'énergie thermique en travail mécanique, base de toute l'industrie motrice et frigorifique mondiale.",
    theorems: [
      "<strong>Premier Principe :</strong> ΔU + ΔEc = W + Q. L'énergie globale se conserve, elle ne fait que changer de forme.",
      "<strong>Second Principe :</strong> ΔS_syst = S_ech + S_cree, avec S_cree ≥ 0. Définit le sens d'évolution irréversible des phénomènes.",
      "<strong>Identités thermodynamiques :</strong> dU = TdS - PdV et dH = TdS + VdP."
    ],
    methods: [
      "Pour un cycle, commencez toujours par ΔU_cycle = 0 pour trouver le lien entre W_tot et Q_tot.",
      "Identifiez le type de transformation (adiabatique, isobare...) pour choisir la bonne loi d'état (Laplace, Gaz parfaits).",
      "Tracez systématiquement le cycle dans un diagramme de Watt (P,V) pour visualiser le signe du travail."
    ],
    errors: [
      "Confondre la température T (en Kelvin) et t (en Celsius) dans les calculs de rendement.",
      "Oublier que le travail W est compté positivement s'il est reçu par le système (convention récepteur).",
      "Appliquer les lois de Laplace (PV^γ = cste) pour une transformation qui n'est pas réversible."
    ]
  }
};

/**
 * Simule la génération de contenu IA en utilisant la base locale
 * @param {string} subjectId - L'ID de la matière
 */
function simulateIAGeneration(subjectId) {
  const data = aiDatabase[subjectId] || aiDatabase['maths'];

  showToast("🧠 Analyse du PDF par l'IA en cours...", 2500);

  const btn = document.querySelector('.ia-lab__btn--active') || document.activeElement;
  if (btn) btn.style.opacity = "0.6";

  setTimeout(() => {
    const fileName = `Synthèse - ${data.chapter}.pdf`;
    const sub = state.subjects[subjectId];
    if (!sub) return;

    // Éviter les doublons
    const alreadyExists = sub.files.find(f => f.name === fileName);

    if (!alreadyExists) {
      sub.files.push({
        name: fileName,
        size: 45000,
        date: new Date().toISOString().slice(0, 10),
        isAIGenerated: true,
        content: data
      });

      saveState();
      if (typeof addXP === 'function') addXP(50);

      Library.render();
      showToast(`✅ Fiche "${data.chapter}" générée ! +50 XP`);
    } else {
      showToast("ℹ️ Cette fiche a déjà été générée.");
    }

    if (btn) btn.style.opacity = "1";
  }, 2500);
}

/**
 * Initialise les écouteurs d'événements pour le Laboratoire IA
 */
function setupIALabDragAndDrop() {
  const zones = [
    { id: 'dropZoneFlashcards', action: 'flashcards' },
    { id: 'dropZoneFiche', action: 'summary' }
  ];

  zones.forEach(zone => {
    const el = document.getElementById(zone.id);
    if (!el) return;

    // 1. Sécurité : Empêcher l'ouverture du PDF par le navigateur
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      el.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, false);
    });

    // 2. Animation : Gestion de la classe .drag-over
    el.addEventListener('dragenter', () => el.classList.add('drag-over'));
    el.addEventListener('dragover', () => el.classList.add('drag-over'));

    el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
    el.addEventListener('drop', () => el.classList.remove('drag-over'));

    // 3. Action : Déclenchement de la génération selon la zone
    el.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      if (file.type !== 'application/pdf') {
        showToast("⚠️ Format invalide. Déposez un PDF.");
        return;
      }

      const subjectId = Library.getSelectedId();
      if (!subjectId) {
        showToast("⚠️ Sélectionnez une matière avant de déposer.");
        return;
      }

      // Dispatch de l'action
      if (zone.action === 'summary') {
        simulateIAGeneration(subjectId);
      } else {
        // On s'assure que cette fonction existe ou on appelle un toast par défaut
        if (typeof simulateFlashcardGeneration === 'function') {
          simulateFlashcardGeneration(subjectId);
        } else {
          showToast("🧠 Génération de flashcards en cours...");
          setTimeout(() => addXP(75), 2500);
        }
      }
    });
  });
}

/**
 * Nouvelle fonction pour la génération de Flashcards
 */
function simulateFlashcardGeneration(subjectId) {
  const data = aiDatabase[subjectId] || aiDatabase['maths'];
  showToast(`🧠 IA : Extraction de ${data.flashcardsCount || 12} flashcards...`);

  setTimeout(() => {
    if (typeof addXP === 'function') addXP(75); // Plus d'XP pour les flashcards
    showToast(`✅ Pack de révision "${data.chapter}" prêt ! +75 XP`);
    // On pourrait ici injecter les cartes dans le Trainer
  }, 2500);
}

// Lancement automatique après le rendu de la page
document.addEventListener('DOMContentLoaded', () => {
  // Petit délai pour s'assurer que Library.render() a bien injecté les IDs
  setTimeout(setupIALabDragAndDrop, 800);
});

// ── LIBRARY MODULE ────────────────────────────────────────────
const Library = (() => {
  let selectedId = null;
  let currentSubView = null; // null (Hub), 'flashcards', 'summaries'

  function render(filter = '') {
    const gridView = document.getElementById('libViewGrid');
    const detailView = document.getElementById('libViewDetail');
    if (!gridView || !detailView) return;

    if (selectedId) {
      gridView.classList.remove('active');
      detailView.classList.add('active');
      renderDetail(selectedId);
    } else {
      detailView.classList.remove('active');
      gridView.classList.add('active');
      renderGrid(filter);
    }
    updateRecap();
  }

  function renderGrid(filter = '') {
    const grid = document.getElementById('subjectsGrid');
    if (!grid) return;

    const ids = Object.keys(state.subjects);
    const q = filter.toLowerCase();

    if (ids.length === 0) {
      grid.innerHTML = `<div class="lib-empty">Aucune matière.</div>`;
      return;
    }

    grid.innerHTML = ids.map(id => {
      const sub = state.subjects[id];
      const count = sub.files.length;
      return `
        <div class="subject-card" onclick="openSubjectHub('${id}')" style="background:${sub.gradient}">
          <div class="subject-card__icon">${sub.icon}</div>
          <div class="subject-card__info">
            <span class="subject-card__name">${sub.name}</span>
            <span class="subject-card__count">${count} document${count !== 1 ? 's' : ''}</span>
          </div>
          <div class="subject-card__mastery">${sub.mastery}%</div>
        </div>`;
    }).join('');
    animateBars();
  }

  function renderDetail(id) {
    const sub = state.subjects[id];
    document.getElementById('detailSubjectName').textContent = sub.name;
    const content = document.getElementById('detailContent');
    const docsSection = document.getElementById('detailDocsSection');

    // Default: show hub
    if (currentSubView === 'flashcards') {
      if (docsSection) docsSection.style.display = 'none';
      renderFlashcardsView(sub);
    } else if (currentSubView === 'summaries') {
      if (docsSection) docsSection.style.display = 'none';
      renderSummariesView(sub);
    } else {
      if (docsSection) docsSection.style.display = 'block';
      renderSubjectHub(sub);
      // Update traditional docs list
      const list = document.getElementById('detailDocsList');
      if (list) {
        if (sub.files.length === 0) {
          list.innerHTML = `<div class="lib-empty-folder">Aucun document.</div>`;
        } else {
          list.innerHTML = sub.files.map(f => renderFileItem(id, f)).join('');
        }
      }

      // ── BRANCHEMENT AUX BOUTONS DU LABORATOIRE IA ──
      if (sub.files.length > 0) {
        const flashcardBtn = document.querySelector('.ia-lab__btn:nth-child(1)');
        const summaryBtn = document.querySelector('.ia-lab__btn:nth-child(2)');
        if (flashcardBtn) {
          flashcardBtn.onclick = () => {
            flashcardBtn.classList.add('ia-lab__btn--active');
            showToast("🧠 Génération des Flashcards — Bientôt disponible.");
            setTimeout(() => flashcardBtn.classList.remove('ia-lab__btn--active'), 2000);
          };
        }
        if (summaryBtn) {
          summaryBtn.onclick = () => {
            summaryBtn.classList.add('ia-lab__btn--active');
            simulateIAGeneration(id);
            setTimeout(() => summaryBtn.classList.remove('ia-lab__btn--active'), 2500);
          };
        }
      }
    }
  }

  function renderSubjectHub(sub) {
    const content = document.getElementById('detailContent');
    if (!content) return;
    content.innerHTML = `
      <div class="revision-hub">
        <div class="hub-card" onclick="Library.setSubView('flashcards')">
          <div class="hub-card__icon">🧠</div>
          <div class="hub-card__title">Mes Flashcards</div>
          <div class="hub-card__count">${sub.files.length * 12} cartes</div>
        </div>
        <div class="hub-card" onclick="Library.setSubView('summaries')">
          <div class="hub-card__icon">📄</div>
          <div class="hub-card__title">Mes Fiches Synthèse</div>
          <div class="hub-card__count">4 fiches</div>
        </div>
      </div>
    `;
  }

  function renderFlashcardsView(sub) {
    const content = document.getElementById('detailContent');
    if (!content) return;
    content.innerHTML = `
      <h3 class="sub-view-title">Révision par Chapitres</h3>
      <div class="chapter-list">
        <div class="chapter-item searchable-item fiche-item chapter-item--master" onclick="showToast('🧠 Révision globale lancée !')">
          <div class="chapter-item__info">
            <span class="chapter-item__name">Toutes mes Flashcards</span>
            <span class="chapter-item__meta">Révision globale du sujet</span>
          </div>
          <span class="chapter-item__badge">${sub.files.length * 12} cartes</span>
        </div>
        ${sub.files.map((f, i) => `
          <div class="chapter-item searchable-item fiche-item" onclick="showToast('📚 Chapitre ${i + 1} — Prêt')">
            <div class="chapter-item__info">
              <span class="chapter-item__name">${f.name.replace('.pdf', '')}</span>
              <span class="chapter-item__meta">Généré le ${fmtDate(f.date)}</span>
            </div>
            <span class="chapter-item__badge">12 cartes</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSummariesView(sub) {
    const content = document.getElementById('detailContent');
    if (!content) return;

    // Utilisation de notre fonction de tri
    const sortedFiles = getSortedFiles(sub.files);

    content.innerHTML = `
      <h3 class="sub-view-title">Fiches de Synthèse</h3>
      <div class="summary-list">
        ${sortedFiles.slice(0, 10).map(f => `
          <div class="summary-item searchable-item fiche-item" onclick="Library.openSummaryModal('${sub.name}', '${f.name}')">
            <div class="summary-item__info">
              <span class="summary-item__name">Synthèse : ${f.name.replace('.pdf', '')}</span>
              <span class="summary-item__meta">Créé le ${fmtDate(f.date)}</span>
            </div>
            <span class="summary-item__icon">👁️</span>
          </div>
        `).join('')}
      </div>
      <div class="lib-empty-folder" style="margin-top:20px; font-size:10px;">
        Triées par date (la plus récente en premier).
      </div>
    `;
  }

  function selectSubject(id) {
    selectedId = id;
    currentSubView = null;
    render();
  }

  function setSubView(view) {
    currentSubView = view;
    render();
  }

  function goBack() {
    if (selectedId) {
      if (currentSubView) {
        // On est dans Flashcards ou Fiches -> On remonte au Hub
        currentSubView = null;
        state.navStack.pop();
      } else {
        // On est dans le Hub -> On remonte à la Grille
        selectedId = null;
        state.navStack = [];
      }
      render();
    } else {
      // Déjà à la racine de la bibliothèque -> Retour Dashboard
      if (typeof navigate === 'function') navigate('pageDashboard');
    }
  }


  // --- Render single file row ---
  function renderFileItem(subjectId, file) {
    return `
      <div class="file-item searchable-item fiche-item">
        <div class="file-item__icon">📄</div>
        <div class="file-item__info">
          <span class="file-item__name">${file.name}</span>
          <span class="file-item__meta">${fmtSize(file.size)} · ${fmtDate(file.date)}</span>
        </div>
        <div class="file-item__actions">
          <button class="file-btn" title="Démarrer une session"
            onclick="event.stopPropagation(); Library.startSession('${subjectId}','${file.name}')">▶</button>
          <button class="file-btn file-btn--danger" title="Supprimer"
            onclick="event.stopPropagation(); Library.deleteFile('${subjectId}','${file.name}')">✕</button>
        </div>
      </div>`;
  }

  // --- Animate progress bars ---
  function animateBars() {
    requestAnimationFrame(() => {
      document.querySelectorAll('.subject-folder__bar-fill[data-width]').forEach(el => {
        el.style.transition = 'width 1s ease';
        el.style.width = el.dataset.width + '%';
      });
    });
  }

  // --- Update recap counters ---
  function updateRecap() {
    const allFiles = Object.values(state.subjects).reduce((acc, s) => acc + s.files.length, 0);
    const subCount = Object.keys(state.subjects).length;
    const el_docs = document.getElementById('recapDocs');
    const el_subs = document.getElementById('recapSubjects');
    const el_storage = document.getElementById('recapStorage');
    if (el_docs) el_docs.textContent = allFiles;
    if (el_subs) el_subs.textContent = subCount;
    if (el_storage) el_storage.textContent = totalStorage();
  }

  // --- Toggle folder open/close ---
  function toggle(id) {
    if (state.openFolders.has(id)) {
      state.openFolders.delete(id);
    } else {
      state.openFolders.add(id);
    }
    saveState();
    render(currentFilter());
  }

  // --- Show all files (expand beyond preview) ---
  function showAll(id) {
    // Re-render folder with no limit
    const sub = state.subjects[id];
    const el = document.querySelector(`[data-subject="${id}"] .subject-folder__files`);
    if (!el || !sub) return;
    const q = currentFilter();
    const files = q ? sub.files.filter(f => f.name.toLowerCase().includes(q)) : sub.files;
    el.innerHTML = files.map(f => renderFileItem(id, f)).join('');
  }

  // --- Delete a file ---
  function deleteFile(subjectId, fileName) {
    const sub = state.subjects[subjectId];
    if (!sub) return;
    sub.files = sub.files.filter(f => f.name !== fileName);
    saveState();
    render(currentFilter());
    showToast(`🗑️ "${fileName}" supprimé`);
  }

  // --- Start a session from a file ---
  function startSession(subjectId, fileName) {
    const sub = state.subjects[subjectId];
    showToast(`▶ Session : ${sub?.name} — ${fileName.replace('.pdf', '')}`);
  }

  // --- Add files to a subject ---
  function addFiles(subjectId, fileList) {
    const sub = state.subjects[subjectId];
    if (!sub) return;
    const today = new Date().toISOString().slice(0, 10);
    let added = 0;
    for (const f of fileList) {
      if (f.type === 'application/pdf') {
        // Avoid duplicate names
        if (!sub.files.find(existing => existing.name === f.name)) {
          sub.files.push({ name: f.name, size: f.size, date: today });
          added++;
        }
      }
    }
    saveState();
    // Open the target folder after import
    state.openFolders.add(subjectId);
    render(currentFilter());
    if (added > 0) {
      gainXPFromAction('upload_pdf');
      showToast(`✅ ${added} PDF importé${added > 1 ? 's' : ''} dans « ${sub.name} »`);
    } else {
      showToast('⚠️ Aucun nouveau PDF — fichiers déjà présents ou format incorrect');
    }
  }

  // --- Add a new subject ---
  function addSubject(name) {
    if (!name || !name.trim()) return;
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (state.subjects[id]) { showToast('⚠️ Cette matière existe déjà'); return; }
    const gradients = [
      'linear-gradient(135deg,#F59E0B,#EF4444)',
      'linear-gradient(135deg,#10B981,#059669)',
      'linear-gradient(135deg,#8B5CF6,#6366F1)',
      'linear-gradient(135deg,#F97316,#EF4444)',
      'linear-gradient(135deg,#EC4899,#F43F5E)',
    ];
    const icons = ['◆', '★', '◉', '⊕', '≈'];
    const idx = Object.keys(state.subjects).length % gradients.length;
    state.subjects[id] = {
      name: name.trim(),
      icon: icons[idx],
      gradient: gradients[idx],
      mastery: 0,
      files: [],
    };
    saveState();
    state.openFolders.add(id);
    render(currentFilter());
    showToast(`📁 Matière « ${name.trim()} » créée !`);
  }



  /**
   * Alterne l'affichage de la barre de recherche et gère le focus
   */
  function toggleSearch() {
    const searchBar = document.getElementById('librarySearchContainer');
    const searchInput = document.getElementById('librarySearch');

    if (!searchBar || !searchInput) return;

    // Bascule de la classe active
    searchBar.classList.toggle('search-active');

    if (searchBar.classList.contains('search-active')) {
      // Focus automatique dès l'ouverture
      setTimeout(() => searchInput.focus(), 100);
      showToast("🔍 Recherche activée");
    } else {
      // Réinitialisation si on ferme
      searchInput.value = '';
      const res = document.getElementById('searchOverlay');
      if (res) res.classList.remove('active');
    }
  }

  function closeSearch() {
    const bar = document.getElementById('librarySearchContainer');
    const input = document.getElementById('librarySearch');
    if (bar && bar.classList.contains('search-active')) {
      toggleSearch();
    } else if (bar) {
      bar.classList.remove('search-active');
      if (input) input.value = '';
      const res = document.getElementById('searchOverlay');
      if (res) res.classList.remove('active');
    }
  }

  // --- Live filter ---
  function currentFilter() {
    const input = document.getElementById('librarySearch');
    return input ? input.value.trim().toLowerCase() : '';
  }

  function openSummaryModal(subjectId, fileName) {
    const overlay = document.getElementById('summaryModalOverlay');
    const content = document.getElementById('summaryContent');
    const title = document.getElementById('summaryModalTitle');

    if (!overlay || !content) return;

    // Récupération des données (On utilise notre base Expert)
    const contextKey = fileName.toLowerCase().includes('math') ? 'maths' : 'physique';
    const d = aiExpertDatabase[contextKey] || aiExpertDatabase['maths'];

    title.textContent = `Expert : ${d.chapter}`;

    content.innerHTML = `
        <div class="expert-sheet">
            <!-- Section Contexte -->
            <div class="expert-block expert-block--context">
                <div class="expert-block__header">🎯 Enjeu du Chapitre</div>
                <div class="expert-block__body">${d.context}</div>
            </div>

            <!-- Section Théorèmes -->
            <div class="expert-block expert-block--theorems">
                <div class="expert-block__header">📜 Théorèmes Fondamentaux</div>
                <div class="expert-block__body">
                    <ul>${d.theorems.map(t => `<li>${t}</li>`).join('')}</ul>
                </div>
            </div>

            <!-- Section Méthodes -->
            <div class="expert-block expert-block--methods">
                <div class="expert-block__header">🛠️ Méthodes & Réflexes DS</div>
                <div class="expert-block__body">
                    <ul>${d.methods.map(m => `<li>${m}</li>`).join('')}</ul>
                </div>
            </div>

            <!-- Section Erreurs -->
            <div class="expert-block expert-block--errors">
                <div class="expert-block__header">⚠️ Ce que le jury déteste</div>
                <div class="expert-block__body">
                    <ul>${d.errors.map(e => `<li>${e}</li>`).join('')}</ul>
                </div>
            </div>
        </div>
    `;

    overlay.classList.add('open');
    if (typeof gainXPFromAction === 'function') gainXPFromAction('read_summary');

    document.getElementById('summaryModalClose').onclick = () => Library.closeSummaryModal();
    document.getElementById('printSummaryBtn').onclick = () => Library.printSummary();
    overlay.onclick = (e) => { if (e.target === overlay) Library.closeSummaryModal(); };
  }

  function closeSummaryModal() {
    const overlay = document.getElementById('summaryModalOverlay');
    if (overlay) {
      overlay.classList.remove('open');
      // Transition propre : on vide le contenu après l'animation
      setTimeout(() => {
        const content = document.getElementById('summaryContent');
        if (content) content.innerHTML = '';
      }, 300);
    }
  }

  function printSummary() {
    window.print();
  }

  return {
    openSummaryModal,
    closeSummaryModal,
    printSummary,
    toggleSearch,
    render, toggle, showAll, deleteFile, addFiles, addSubject, closeSearch, startSession, updateRecap, selectSubject, goBack, setSubView, getSelectedId: () => selectedId
  };
})();

// ── SUBJECT PICKER MODAL ─────────────────────────────────────
let pendingFiles = [];

function openSubjectPicker(files) {
  pendingFiles = files;
  const overlay = document.getElementById('subjectPickerOverlay');
  const optsCont = document.getElementById('modalOptions');
  if (!overlay || !optsCont) return;

  optsCont.innerHTML = Object.entries(state.subjects).map(([id, sub]) => `
    <button class="modal__option" onclick="confirmUpload('${id}')">
      <div class="modal__option-icon" style="background:${sub.gradient}">${sub.icon}</div>
      <div class="modal__option-info">
        <span class="modal__option-name">${sub.name}</span>
        <span class="modal__option-count">${sub.files.length} doc${sub.files.length !== 1 ? 's' : ''}</span>
      </div>
      <span class="modal__option-arrow">→</span>
    </button>
  `).join('');

  overlay.classList.add('open');
}

function closeSubjectPicker() {
  document.getElementById('subjectPickerOverlay')?.classList.remove('open');
  pendingFiles = [];
}

function confirmUpload(subjectId) {
  closeSubjectPicker();
  Library.addFiles(subjectId, pendingFiles);
}

// ── NAVIGATION ───────────────────────────────────────────────
const navMap = {
  pageDashboard: 'nav-dashboard',
  pageBibliotheque: 'nav-bibliotheque',
  pageEntrainement: 'nav-entrainement',
  pageClassement: 'nav-classement',
  pageTraining: 'nav-training',
};

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navId = navMap[pageId];
  if (navId) document.getElementById(navId)?.classList.add('active');
  document.getElementById('mainContent').scrollTop = 0;
  if (pageId === 'pageBibliotheque') Library.render();
  if (pageId === 'pageEntrainement') {
    if (typeof Trainer !== 'undefined') Trainer.init();
    showToast("Prêt pour une nouvelle semaine d'excellence ✨", 3000);
  }
}

/**
 * Gère l'affichage des conteneurs principaux
 */
function showView(targetId) {
  const views = ['view-dashboard', 'view-planning', 'view-bibliotheque', 'view-classement', 'view-entrainement', 'view-settings', 'view-subject-physics'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetId) {
        el.classList.remove('hidden');
        el.classList.add('block');
      } else {
        el.classList.remove('block');
        el.classList.add('hidden');
      }
    }
  });
}

/**
 * Basculement binaire entre Planning et Réglages (Strict Reset)
 */
function switchView(targetView) {
  const planning = document.getElementById('view-planning');
  const settings = document.getElementById('view-settings');

  if (targetView === 'settings') {
    planning.classList.replace('block', 'hidden');
    settings.classList.replace('hidden', 'block');
  } else {
    settings.classList.replace('block', 'hidden');
    planning.classList.replace('hidden', 'block');
  }
}

// ── TOAST ────────────────────────────────────────────────────
let toastTimeout;
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimeout);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimeout = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── WIRING ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ── Load persisted state ──
  loadState();

  // ── Navigation default ──
  document.getElementById('nav-dashboard')?.classList.add('active');

  // ── Upload zone ──
  const uploadZone = document.getElementById('uploadZone');
  const uploadTrigger = document.getElementById('uploadTrigger');
  const fileInput = document.getElementById('fileInput');

  const triggerFilePicker = (e) => {
    e?.stopPropagation?.();
    fileInput?.click();
  };
  uploadTrigger?.addEventListener('click', triggerFilePicker);
  uploadZone?.addEventListener('click', triggerFilePicker);

  fileInput?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const activeId = Library.getSelectedId();
      if (activeId) {
        Library.addFiles(activeId, files);
      } else {
        openSubjectPicker(files);
      }
    }
    fileInput.value = '';
  });

  // Drag & drop
  uploadZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
  });
  uploadZone?.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length > 0) {
      const activeId = Library.getSelectedId();
      if (activeId) {
        Library.addFiles(activeId, files);
      } else {
        openSubjectPicker(files);
      }
    }
  });

  // ── Search ──
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('librarySearch');

  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Library.toggleSearch();
    });
  }

  if (searchInput) {
    initPageBlancheSearch();
  }

  // ── Add subject ──
  document.getElementById('addSubjectBtn')?.addEventListener('click', () => {
    const name = prompt('Nom de la nouvelle matière :');
    if (name) Library.addSubject(name);
  });

  // ── Subject picker modal close ──
  document.getElementById('modalClose')?.addEventListener('click', closeSubjectPicker);
  document.getElementById('subjectPickerOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'subjectPickerOverlay') closeSubjectPicker();
  });
  document.getElementById('modalNewSubject')?.addEventListener('click', () => {
    closeSubjectPicker();
    const name = prompt('Nom de la nouvelle matière :');
    if (name) {
      Library.addSubject(name);
      // Re-open picker with same files but new subject now available
      if (pendingFiles.length) openSubjectPicker(pendingFiles);
    }
  });

  // ── Dashboard: Continue button ──
  document.getElementById('btnContinue')?.addEventListener('click', () => {
    showToast('▶ Reprise de la session…');
    setTimeout(() => navigate('pageTraining'), 700);
  });

  // ── Dashboard: Add session──
  document.getElementById('addSessionBtn')?.addEventListener('click', () => {
    showToast('➕ Nouvelle session — Bientôt disponible');
  });

  // ── Streak count animation ──
  const streakEl = document.getElementById('streakCount');
  if (streakEl) {
    const target = parseInt(streakEl.textContent, 10) || 0;
    let val = 0;
    streakEl.textContent = '0';
    const step = () => {
      if (val < target) { val++; streakEl.textContent = val; setTimeout(step, 55); }
    };
    setTimeout(step, 500);
  }

  // ── Animate dashboard bars on load ──
  setTimeout(() => {
    document.querySelectorAll('.streak-progress__fill, .leaderboard-item__bar').forEach(el => {
      const w = el.style.width;
      el.style.width = '0%';
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.width = w; }));
    });
  }, 200);

  // ── Training Navigation ──
  document.getElementById('btn-flashcards')?.addEventListener('click', () => switchView('flashcards-screen'));
  document.getElementById('btn-quiz')?.addEventListener('click', () => switchView('quiz-screen'));
  document.getElementById('btn-qcm')?.addEventListener('click', () => switchView('qcm-screen'));

});

/* ════════════════════════════════════════════
   TRAINER MODULE — Leitner Flashcard Engine
════════════════════════════════════════════ */
const Trainer = (() => {

  // ── Sample deck (will be replaced by AI-generated cards) ──
  const DECK = [
    {
      level: 'Niveau 3',
      subject: 'Physique-Chimie · MP*',
      question: "Donner la forme locale de l'équation de Maxwell-Faraday dans le vide.",
      hint: "💡 Relie le rotationnel du champ électrique à la variation temporelle du champ magnétique.",
      answer: "rot <strong>E</strong> = −∂<strong>B</strong>/∂t",
      detail: "Le rotationnel du champ électrique est égal à l'opposé de la dérivée temporelle du champ magnétique. C'est la loi de Faraday sous forme locale.",
    },
    {
      level: 'Niveau 2',
      subject: 'Mathématiques · MP*',
      question: "Énoncer le théorème de Rolle.",
      hint: "💡 Conditions : continuité sur [a,b], dérivabilité sur ]a,b[, et valeurs égales aux extrémités.",
      answer: "∃ c ∈ ]a,b[ : <strong>f'(c) = 0</strong>",
      detail: "Si f est continue sur [a,b], dérivable sur ]a,b[ et f(a) = f(b), alors il existe au moins un point c où la dérivée s'annule.",
    },
    {
      level: 'Niveau 1',
      subject: 'Philosophie · MP*',
      question: "Quelle est la distinction kantienne entre phénomène et noumène ?",
      hint: "💡 Pense à la limite de notre connaissance sensible selon la Critique de la Raison Pure.",
      answer: "Phénomène = ce qui <strong>apparaît</strong> ; Noumène = la <strong>chose en soi</strong>",
      detail: "Le phénomène est l'objet tel qu'il nous apparaît via nos formes a priori de la sensibilité. Le noumène est la réalité en soi, inconnaissable par l'entendement humain.",
    },
  ];

  let currentIndex = 0;
  let isFlipped = false;
  let totalXP = 50;
  let answeredCount = 26;
  const totalCards = 40;

  // ── Render current card ──
  function renderCard() {
    const card = DECK[currentIndex % DECK.length];
    isFlipped = false;

    const flipEl = document.getElementById('flipCard');
    flipEl?.classList.remove('is-flipped');

    // Sync label in both faces
    ['cardLevel', 'cardLevelBack'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = card.level;
    });

    const q = document.getElementById('cardQuestion');
    if (q) q.textContent = card.question;

    const h = document.getElementById('cardHint');
    if (h) h.textContent = card.hint;

    const a = document.getElementById('cardAnswer');
    if (a) a.innerHTML = card.answer;

    const d = document.getElementById('cardAnswerDetail');
    if (d) d.textContent = card.detail;

    const sub = document.getElementById('trainSubjectLabel');
    if (sub) sub.textContent = card.subject;

    // Reset button states
    document.querySelectorAll('.train-btn').forEach(b => b.style.opacity = '1');
  }

  // ── Flip ──
  function flip() {
    const card = document.getElementById('flipCard');
    if (!card) return;
    isFlipped = !isFlipped;
    card.classList.toggle('is-flipped', isFlipped);
  }

  // ── Answer (Leitner scoring) ──
  function answer(type) {
    if (!isFlipped) {
      // Must reveal card first
      flip();
      showToast('👆 Révèle la carte avant de répondre !');
      return;
    }

    const xpMap = { revoir: 5, correct: 15, parfait: 25 };
    const xpGain = xpMap[type] || 0;
    totalXP += xpGain;
    answeredCount = Math.min(answeredCount + 1, totalCards);

    // Update progress bar
    const pct = Math.round((answeredCount / totalCards) * 100);
    const fill = document.getElementById('trainProgressFill');
    if (fill) fill.style.width = pct + '%';

    const cur = document.getElementById('trainCurrent');
    if (cur) cur.textContent = answeredCount;

    const xpEl = document.getElementById('trainXP');
    if (xpEl) xpEl.textContent = `+${totalXP} XP accumulés`;

    // Show XP popup
    if (xpGain > 0) showXPPopup(`+${xpGain} XP`);

    // Toast
    const msgs = {
      revoir: '🔄 Carte remise en haut du paquet',
      correct: '✅ Bien joué ! Carte montée d\'un niveau',
      parfait: '⭐ Parfait ! Maîtrise maximale',
    };
    showToast(msgs[type] || '');

    // Next card after short delay
    setTimeout(() => {
      currentIndex++;
      if (answeredCount >= totalCards) {
        // Session complete
        showToast('🎉 Session terminée ! +' + totalXP + ' XP gagnés');
        setTimeout(() => navigate('pageDashboard'), 1800);
      } else {
        renderCard();
      }
    }, 700);
  }

  // ── XP animated popup ──
  function showXPPopup(text) {
    const el = document.getElementById('xpPopup');
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ── Init when entering training page ──
  function init() {
    renderCard();
    // Animate progress bar in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const pct = Math.round((answeredCount / totalCards) * 100);
        const fill = document.getElementById('trainProgressFill');
        if (fill) { fill.style.width = '0%'; setTimeout(() => fill.style.width = pct + '%', 60); }
      });
    });
  }

  function resetSession() {
    currentIndex = 0;
    isFlipped = false;
  }

  return { flip, answer, init, resetSession };
})();

// ── MODULE LIVE ACTIVITY (Nouveau Dashboard) ──────────────────────
const LiveActivity = (() => {
  function init() {
    // Ticking Clock for Dynamic Island
    const timeEl = document.querySelector('.live-activity__time');
    if (timeEl) {
      setInterval(() => {
        const now = new Date();
        timeEl.textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      }, 1000);
      timeEl.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    // Schedule Scanner Logic
    const scanner = document.getElementById('scheduleScanner');
    const fileInput = document.getElementById('scheduleInput');

    if (scanner && fileInput) {
      // Handle drag & drop visuals
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        scanner.addEventListener(eventName, preventDefaults, false);
      });

      function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
      }

      ['dragenter', 'dragover'].forEach(eventName => {
        scanner.addEventListener(eventName, () => scanner.classList.add('drag-over'), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        scanner.addEventListener(eventName, () => scanner.classList.remove('drag-over'), false);
      });

      scanner.addEventListener('drop', handleDrop, false);
      scanner.addEventListener('click', () => fileInput.click()); // Click to upload

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          triggerScanAnimation(e.target.files[0].name);
        }
      });

      function handleDrop(e) {
        let dt = e.dataTransfer;
        let files = dt.files;
        if (files.length) {
          triggerScanAnimation(files[0].name);
        }
      }

      function triggerScanAnimation(fileName) {
        scanner.classList.add('is-scanning');
        showToast(`📸 Analyse de "${fileName}" en cours...`);

        setTimeout(() => {
          scanner.classList.remove('is-scanning');
          smartScheduleAnalysis(fileName + " colloscope"); // Simulation du Cerveau Praxis de fusion
        }, 2000);
      }
    }

    // Recalculate Button
    const btnRecalculate = document.getElementById('btnRecalculate');
    if (btnRecalculate) {
      btnRecalculate.addEventListener('click', () => {
        btnRecalculate.style.transform = 'rotate(360deg)';
        showToast("🔄 Recalcul de votre journée en cours...");
        setTimeout(() => {
          btnRecalculate.style.transform = 'none';
          showToast("✅ Planning optimisé par l'IA.");
        }, 1500);
      });
    }
  }

  function addImportedCourseTimelineItem() {
    const timeline = document.getElementById('dailyTimeline');
    if (!timeline) return;

    const newItem = document.createElement('div');
    newItem.className = 'timeline-item timeline-item--imported';
    newItem.style.animation = 'fadeInUp 0.5s ease backwards';

    const now = new Date();
    // Simulate next hour
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    newItem.innerHTML = `
      <div class="timeline-item__time">${timeStr}</div>
      <div class="timeline-item__content">
        <div class="timeline-item__title">Nouveau Cours Importé</div>
        <div class="timeline-item__meta">Mise à jour · Salle X</div>
      </div>
    `;

    timeline.appendChild(newItem);
    timeline.scrollTo({ top: timeline.scrollHeight, behavior: 'smooth' });
  }

  return { init };
})();

// ── INITIALISATION & ÉVÉNEMENTS GLOBAUX ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // 1. Gestion de la fermeture du Modal de Synthèse (Croix, Overlay, Echap)
  const summaryOverlay = document.getElementById('summaryModalOverlay');
  const summaryCloseBtn = document.getElementById('summaryModalClose');

  if (summaryCloseBtn) {
    summaryCloseBtn.onclick = (e) => {
      e.stopPropagation();
      Library.closeSummaryModal();
    };
  }

  if (summaryOverlay) {
    summaryOverlay.onclick = (e) => {
      if (e.target === summaryOverlay) Library.closeSummaryModal();
    };
  }

  document.addEventListener('keydown', (e) => {
    // Fermeture des modaux Globaux
    if (e.key === 'Escape') {
      if (summaryOverlay?.classList.contains('open')) {
        Library.closeSummaryModal();
      }

      const praxisOverlay = document.getElementById('praxis-modal-overlay');
      if (praxisOverlay && praxisOverlay.style.display === 'flex') {
        closePraxisModal();
      }
    }
  });

  // Sync UI with progression
  updateXPDisplay();

  // Vérification du bonus quotidien
  const today = new Date().toISOString().slice(0, 10);
  if (state.progression.lastActionDate !== today) {
    state.progression.lastActionDate = today;
    saveProgression();
    setTimeout(() => {
      gainXPFromAction('daily_login');
      showToast("🎁 Bonus de connexion quotidienne : +150 XP");
    }, 2000);
  }

  // Initialisation du tracker LiveActivity
  LiveActivity.init();

  // Lancement du timer pour simuler une montée en rang (Atmosphère Premium)
  setInterval(() => {
    const rankEl = document.querySelector('.rank-badge__value');
    if (rankEl && Math.random() > 0.8) {
      showToast("📈 Bravo Henri ! Tu gagnes une place au classement.");
    }
  }, 30000);
});

/* ============================================================
   PRAXIS — Mode Recherche 'Page Blanche' (Full Overlay)
   ============================================================ */

/**
 * Initialise le système de recherche plein écran
 */
function initPageBlancheSearch() {
  // Override searchInput selector to match Praxis template
  const searchInput = document.getElementById('librarySearch');
  const searchOverlay = document.getElementById('searchOverlay');
  const resultsList = document.getElementById('searchResultsList');

  if (!searchInput || !searchOverlay || !resultsList) return;

  // Remove existing listener to prevent duplicate binding
  const newSearchInput = searchInput.cloneNode(true);
  searchInput.parentNode.replaceChild(newSearchInput, searchInput);

  // 1. OUVERTURE & FILTRAGE
  newSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();

    if (query.length > 0) {
      searchOverlay.classList.add('active'); // CSS: display: block; background: rgba(255,255,255,0.95);
      updateSearchResults(query);
    } else {
      closePageBlanche();
    }
  });

  // 2. TOUCHE ENTER : OUVERTURE DU PREMIER RÉSULTAT
  newSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const firstResult = resultsList.querySelector('.search-result-item');
      if (firstResult) {
        const subjectId = firstResult.dataset.subjectId;
        const fileName = firstResult.dataset.fileName;

        // Action d'ouverture
        Library.selectSubject(subjectId);
        // Note: The logic here assumes isAIGenerated. Using openSummaryModal for all items based on current mock logic, but usually we would check.
        // For simplicity, following the provided instructions.
        Library.openSummaryModal(subjectId, fileName);

        // Fermeture
        closePageBlanche();
        newSearchInput.value = '';
        newSearchInput.blur();
        showToast(`🚀 Ouverture rapide : ${fileName}`);
        Library.closeSearch();
      }
    }

    // Fermeture via Échap
    if (e.key === 'Escape') {
      closePageBlanche();
      newSearchInput.value = '';
      newSearchInput.blur();
      Library.closeSearch();
    }
  });

  /**
   * Met à jour la liste des résultats dynamiquement
   */
  function updateSearchResults(query) {
    resultsList.innerHTML = '';
    let count = 0;

    Object.keys(state.subjects).forEach(subjectId => {
      const subject = state.subjects[subjectId];
      subject.files.forEach(file => {
        if (file.name.toLowerCase().includes(query)) {
          count++;
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.dataset.subjectId = subjectId;
          item.dataset.fileName = file.name;

          // Style "Expert" pour le résultat
          item.innerHTML = `
                        <div class="result-icon">📄</div>
                        <div class="result-text">
                            <span class="result-title">${file.name}</span>
                            <span class="result-meta">${subject.name}</span>
                        </div>
                        <div class="result-hint">${count === 1 ? '⏎ Appuyez sur Enter' : ''}</div>
                    `;

          item.onclick = () => {
            Library.selectSubject(subjectId);
            Library.openSummaryModal(subjectId, file.name);
            closePageBlanche();
            newSearchInput.value = '';
            Library.closeSearch();
          };

          resultsList.appendChild(item);
        }
      });
    });

    if (count === 0) {
      resultsList.innerHTML = `<div class="no-results">Aucun fichier trouvé pour "${query}"</div>`;
    }
  }

  function closePageBlanche() {
    searchOverlay.classList.remove('active');
  }
}

/* ============================================================
   PRAXIS — Vision AI & Algorithme de Fraîcheur Mentale
   ============================================================ */

/**
 * Analyse l'image et déduit le profil de l'élève pour remplir les vides
 */
async function processVisualSchedule(imageFile) {
  showToast("📸 Analyse visuelle de l'emploi du temps...");

  // 1. SIMULATION OCR & EXTRACTION JSON
  // L'IA extrait les cours fixes
  const fixedCourses = [
    { day: 'Lundi', start: 8, end: 10, subject: 'Maths' },
    { day: 'Lundi', start: 10, end: 12, subject: 'Physique' },
    { day: 'Lundi', start: 14, end: 16, subject: 'EPS' }, // Indice profil : Sportif
  ];

  // 2. IDENTIFICATION DES VIDES (GAPS)
  const gaps = [
    { day: 'Lundi', start: 12, end: 14 }, // Pause déj
    { day: 'Lundi', start: 16, end: 19 }, // Soirée
  ];

  // 3. RECUPERATION DES FICHES IA DEPUIS LA BIBLIOTHEQUE (injectStudySessions logic)
  const allRecentFiles = [];
  if (typeof state !== 'undefined' && state.subjects) {
    Object.values(state.subjects).forEach(sub => {
      if (sub.files) {
        sub.files.forEach(f => {
          if (f.isAIGenerated || f.name.includes("Synthèse")) {
            allRecentFiles.push({ name: f.name, subject: sub.name });
          }
        });
      }
    });
  }

  // 4. ALGORITHME DE FRAÎCHEUR MENTALE & PRIORITÉS
  let sessionIndex = 0;
  const smartPlanning = gaps.map(gap => {
    const duration = gap.end - gap.start;
    const workLoadSoFar = fixedCourses.filter(c => c.day === gap.day && c.end <= gap.start).length;

    // Logique de déduction :
    // - Si beaucoup de cours avant : Loisir/Sport pour recharger
    // - Si peu de cours : Révision intense avec les VRAIES fiches de la bibliothèque
    if (workLoadSoFar >= 3 || gap.start >= 16) {
      return { ...gap, activity: 'Loisir & Récupération', color: '#10B981', reason: 'Fatigue cognitive détectée' };
    } else {
      let activityName = 'Révision : Fiches Récentes';
      let reason = 'Pic de concentration matinal';

      if (allRecentFiles.length > sessionIndex) {
        const file = allRecentFiles[sessionIndex];
        activityName = `Révision : ${file.name.replace('.pdf', '')}`;
        reason = `Session suggérée IA (${file.subject})`;
        sessionIndex++;
      }

      return { ...gap, activity: activityName, color: '#6366F1', reason: reason };
    }
  });

  // 4. INJECTION DANS L'UI
  updateCalendarUI(fixedCourses, smartPlanning);
  showToast("✅ Planning optimisé selon ta fraîcheur mentale !");
}

function updateCalendarUI(fixed, smart) {
  const container = document.getElementById('dailyTimeline');
  if (!container) return;

  const allEvents = [
    ...fixed.map(c => ({ ...c, type: 'fixed' })),
    ...smart.map(s => ({ ...s, type: 'smart' }))
  ].sort((a, b) => a.start - b.start);

  const headerHtml = `
    <div class="freshness-easter-egg" title="Batterie Cognitive : 75%">🔋</div>
  `;

  // Construction des éléments avec D&D pour les praxis
  const eventsHtml = allEvents.map((ev, index) => {
    const delay = index * 0.1;
    if (ev.type === 'fixed') {
      return `<div class="timeline-item timeline-item--imported" style="animation: fadeInUp 0.4s ease backwards; animation-delay: ${delay}s;">
          <div class="timeline-item__time">${ev.start.toString().padStart(2, '0')}:00</div>
          <div class="timeline-item__content">
            <div class="timeline-item__title">${ev.subject}</div>
            <div class="timeline-item__meta">Cours fixé 🔒</div>
          </div>
        </div>`;
    } else {
      return `<div class="timeline-item timeline-item--praxis draggable-praxis" draggable="true" style="animation: fadeInUp 0.4s ease backwards; animation-delay: ${delay}s; border-left: 3px solid ${ev.color}; cursor: grab;">
          <div class="timeline-item__time">${ev.start.toString().padStart(2, '0')}:00</div>
          <div class="timeline-item__content">
            <div class="timeline-item__title" style="color: ${ev.color};">${ev.activity}</div>
            <div class="timeline-item__meta">IA ✨ · Déplaçable</div>
          </div>
        </div>`;
    }
  }).join('');

  container.innerHTML = headerHtml + eventsHtml;

  // Initialisation du Drag & Drop
  initTimelineDragAndDrop(container);
}

function initTimelineDragAndDrop(container) {
  let draggedItem = null;

  const items = container.querySelectorAll('.draggable-praxis');
  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      setTimeout(() => item.classList.add('dragging'), 0);
    });

    item.addEventListener('dragend', () => {
      draggedItem.classList.remove('dragging');
      draggedItem = null;
    });
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    const afterElement = getDragAfterElement(container, e.clientY);
    if (draggedItem) {
      if (afterElement == null) {
        container.appendChild(draggedItem);
      } else {
        container.insertBefore(draggedItem, afterElement);
      }
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.timeline-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ============================================================
   PRAXIS — Moteur Colloscope & Algorithme de Priorisation
   ============================================================ */

// 1. DATA COLLOSCOPE (Simulé pour le Groupe 1)
const COLLOSCOPE_DATA = {
  group: 1,
  schedule: {
    semaine3: {
      colle: { type: 'Maths', teacher: 'SR', slot: 'Mercredi 17h30' },
      ds: { type: 'Maths/SI', slot: 'Samedi 8h00' }
    },
    semaine4: {
      colle: { type: 'Physique', teacher: 'EC', slot: 'Mercredi 17h30' },
      ds: { type: 'Français', slot: 'Samedi 8h00' }
    }
  }
};

/**
 * Analyse la semaine actuelle et génère les blocs de travail prioritaires
 */
function automatePlanning(weekNumber) {
  const data = COLLOSCOPE_DATA.schedule[`semaine${weekNumber}`];
  if (!data) return;

  showToast(`📅 Analyse du Colloscope (Semaine ${weekNumber}) pour le Groupe 1...`);

  // 2. ALGORITHME DE SOIRÉE : GÉNÉRATION DES BLOCS
  const eveningBlocks = [
    { id: 'urgent', title: '📚 Devoirs du lendemain', priority: 'A', duration: '1h30' },
    { id: 'colle', title: `🧠 Révision Colle : ${data.colle.type} (${data.colle.teacher})`, priority: 'B', duration: '2h00' },
    { id: 'consolidation', title: '📑 Consolidation du cours du jour', priority: 'C', duration: '1h00' }
  ];

  // 3. LOGIQUE DE PRIORISATION DS DU SAMEDI
  if (data.ds) {
    eveningBlocks.unshift({ id: 'ds_prep', title: `🔥 Prépa DS : ${data.ds.type}`, priority: 'S', duration: '2h00', color: 'var(--gold)' });
  }

  renderSmartTimeline(eveningBlocks);
}

/**
 * Permet d'interchanger deux blocs de travail (Drag & Drop Logic)
 */
function swapBlocks(blockA_Id, blockB_Id) {
  const timeline = document.getElementById('dailyTimeline');
  if (!timeline) return;
  const items = Array.from(timeline.children);

  // Simule la permutation logiquement
  showToast("🔄 Planning ajusté manuellement.");
  if (typeof addXP === 'function') addXP(10); // Récompense l'organisation proactive
}

function handleDragStart(event) {
  event.target.classList.add('dragging');
}

/**
 * Rendu visuel de la Timeline Intelligente
 */
function renderSmartTimeline(blocks) {
  // Changement d'ID pour s'adapter à la structure existante
  const container = document.getElementById('dailyTimeline');
  if (!container) return;

  container.innerHTML = `
        <div class="smart-priority-header">Priorités de la soirée</div>
        <div class="smart-blocks-list" id="sortableList">
            ${blocks.map(b => `
                <div class="work-block" id="${b.id}" draggable="true" ondragstart="handleDragStart(event)">
                    <div class="work-block__priority" style="${b.color ? 'background:' + b.color : ''}">${b.priority}</div>
                    <div class="work-block__info">
                        <strong>${b.title}</strong>
                        <span>${b.duration} estimé</span>
                    </div>
                    <div class="work-block__handle">☰</div>
                </div>
            `).join('')}
        </div>
    `;

  // Initialize D&D on the new blocks using the previously defined initTimelineDragAndDrop
  // Need strictly matching classes so we adjust initTimelineDragAndDrop wrapper class dynamically
  const items = container.querySelectorAll('.work-block');
  let draggedItem = null;

  items.forEach(item => {
    item.addEventListener('dragstart', () => {
      draggedItem = item;
      setTimeout(() => item.classList.add('dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
    });
  });

  const sortableList = document.getElementById('sortableList');
  if (sortableList) {
    sortableList.addEventListener('dragover', (e) => {
      e.preventDefault();
      const afterElement = [...sortableList.querySelectorAll('.work-block:not(.dragging)')].reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = e.clientY - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset: offset, element: child };
        } else {
          return closest;
        }
      }, { offset: Number.NEGATIVE_INFINITY }).element;

      if (draggedItem) {
        if (afterElement == null) {
          sortableList.appendChild(draggedItem);
        } else {
          sortableList.insertBefore(draggedItem, afterElement);
        }
      }
    });
    sortableList.addEventListener('drop', () => swapBlocks());
  }
}

/* ============================================================
   MODE QUIZ (CHALLENGE CHRONO)
   ============================================================ */

const QUIZ_DATA = [
  {
    question: "Énoncé du théorème de l'énergie cinétique ?",
    options: [
      "$\\Delta E_c = \\sum W(\\vec{F})$",
      "$\\Delta E_p = \\sum W(\\vec{F})$",
      "$E_m = cte$",
      "$\\Delta E_c = 0$"
    ],
    correctInd: 0
  },
  {
    question: "Quelle est la dérivée de $f(x) = \\ln(x^2 + 1)$ ?",
    options: [
      "$\\frac{1}{x^2+1}$",
      "$\\frac{2x}{x^2+1}$",
      "$\\frac{x}{x^2+1}$",
      "$2x \\ln(x^2+1)$"
    ],
    correctInd: 1
  },
  // On simule 10 questions en répétant
  ...Array(8).fill({
    question: "Soit $A \\in \\mathcal{M}_n(\\mathbb{R})$ symétrique. Que peut-on dire de $A$ ?",
    options: ["Inversible", "Diagonalisable", "Définie positive", "Nilpotente"],
    correctInd: 1
  })
];

let currentQuizState = {
  active: false,
  questionIdx: 0,
  score: 0,
  xpEarned: 0,
  timerInterval: null,
};

function startQuizMode() {
  currentQuizState = {
    active: true,
    questionIdx: 0,
    score: 0,
    xpEarned: 0,
    timerInterval: null,
    wrongAnswers: []
  };

  document.getElementById('quizResultOverlay').style.display = 'none';
  loadQuizQuestion();
}

function loadQuizQuestion() {
  const qData = QUIZ_DATA[currentQuizState.questionIdx];
  if (!qData) {
    endQuizMode();
    return;
  }

  // Header update
  document.getElementById('quizProgressText').textContent = `Question ${currentQuizState.questionIdx + 1}/${QUIZ_DATA.length}`;
  document.getElementById('quizXpText').textContent = `${currentQuizState.xpEarned} XP ⚡`;

  // Question update
  const questionEl = document.getElementById('quizQuestionText');
  questionEl.innerHTML = qData.question;

  // Answers update
  const answersBox = document.getElementById('quizAnswersContainer');
  answersBox.innerHTML = '';
  qData.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-btn';
    btn.innerHTML = `<span style="opacity:0.5; font-size:14px; width:24px;">${['A', 'B', 'C', 'D'][idx]}</span> <span>${opt}</span>`;
    btn.onclick = () => handleQuizAnswer(idx, btn);
    answersBox.appendChild(btn);
  });

  // Rendu LaTeX
  if (window.renderMathInElement) {
    renderMathInElement(questionEl, {
      delimiters: [{ left: "$", right: "$", display: false }]
    });
    renderMathInElement(answersBox, {
      delimiters: [{ left: "$", right: "$", display: false }]
    });
  }

  startQuizTimer();
}

function startQuizTimer() {
  clearInterval(currentQuizState.timerInterval);
  const timerBar = document.getElementById('quizTimerBar');
  timerBar.classList.remove('warning');
  timerBar.style.transition = 'none';
  timerBar.style.width = '100%';

  // Petit délai pour forcer le reflow CSS
  setTimeout(() => {
    timerBar.style.transition = 'width 15s linear, background-color 0.3s ease';
    timerBar.style.width = '0%';
  }, 50);

  let timeLeft = 15;
  currentQuizState.timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft === 5) {
      timerBar.classList.add('warning');
    }
    if (timeLeft <= 0) {
      clearInterval(currentQuizState.timerInterval);
      handleQuizAnswer(-1, null); // Time out
    }
  }, 1000);
}

function handleQuizAnswer(selectedIdx, btnElement) {
  clearInterval(currentQuizState.timerInterval);
  const qData = QUIZ_DATA[currentQuizState.questionIdx];
  const buttons = document.querySelectorAll('.quiz-btn');

  // Bloquer les clics supplémentaires
  buttons.forEach(b => b.onclick = null);

  if (selectedIdx === qData.correctInd) {
    if (btnElement) btnElement.classList.add('correct');
    currentQuizState.score++;
    currentQuizState.xpEarned += 15;
  } else {
    // Mauvaise réponse (ou timeout si -1)
    if (btnElement) btnElement.classList.add('wrong');
    if (buttons[qData.correctInd]) buttons[qData.correctInd].classList.add('correct');

    currentQuizState.wrongAnswers.push({
      question: qData.question,
      userAnswer: selectedIdx === -1 ? "Non répondu" : qData.options[selectedIdx],
      correctAnswer: qData.options[qData.correctInd]
    });
  }

  // Header direct update for validation visual
  document.getElementById('quizXpText').textContent = `${currentQuizState.xpEarned} XP ⚡`;

  // Question suivante après 1.5s
  setTimeout(() => {
    currentQuizState.questionIdx++;
    loadQuizQuestion();
  }, 1500);
}

function endQuizMode() {
  document.getElementById('quizResultOverlay').style.display = 'flex';
  document.getElementById('quizResultScore').textContent = `${currentQuizState.score}/${QUIZ_DATA.length}`;
  document.getElementById('quizResultXp').textContent = `+${currentQuizState.xpEarned} XP ⚡`;

  // Global XP addition si la fonction existe
  if (typeof addXP === 'function') addXP(currentQuizState.xpEarned);

  // Confetti si score supérieur à 80%
  if (currentQuizState.score / QUIZ_DATA.length >= 0.8) {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4E6AFF', '#F59E0B', '#10B981']
      });
    }
  }

  // Appeler la nouvelle logique de fin de session
  currentQuizState.wrongAnswers.forEach((qData, idx) => {
    // Adapter le format pour recordQuizError
    recordQuizError({
      id: `q-${currentQuizState.questionIdx - currentQuizState.wrongAnswers.length + idx}`,
      question: qData.question,
      answer: qData.correctAnswer,
      detail: "" // Placeholder si besoin
    });
  });
  handleSessionEnd(currentQuizState.xpEarned);
}

/* ============================================================
   PRAXIS — Système de Remédiation (Gestion des Erreurs)
   ============================================================ */

// 1. STOCKAGE DES ERREURS
let lastQuizErrors = [];

/**
 * Enregistre une erreur pendant la session de quiz
 * @param {Object} questionObj - L'objet complet de la question ratée
 */
function recordQuizError(questionObj) {
  if (!lastQuizErrors.find(q => q.id === questionObj.id)) {
    lastQuizErrors.push(questionObj);
  }
}

/**
 * Met à jour le bouton de révision en fin de session
 * @param {number} score - Le score final sur 10
 */
function updateReviewButton(score) {
  const reviewBtn = document.getElementById('revoir-erreurs-btn');
  if (!reviewBtn) return;

  if (lastQuizErrors.length === 0) {
    // État : Zéro faute
    reviewBtn.innerHTML = "✨ Zéro faute ! ✨";
    reviewBtn.classList.add('btn--disabled');
    reviewBtn.style.opacity = "1";
    reviewBtn.style.pointerEvents = "auto";
    reviewBtn.style.cursor = "default";
    reviewBtn.style.backgroundColor = "var(--green)"; // Vert clair
    reviewBtn.style.color = "#065f46"; // Vert très foncé
    reviewBtn.style.fontWeight = "bold"; // Gras
    reviewBtn.style.boxShadow = "inset 0 0 10px rgba(255, 255, 255, 0.4), 0 0 15px rgba(34, 197, 94, 0.5)"; // Glow
    reviewBtn.onclick = null;
  } else {
    // État : Erreurs à revoir
    reviewBtn.innerHTML = `Revoir mes erreurs (${lastQuizErrors.length})`;
    reviewBtn.classList.remove('btn--disabled');
    reviewBtn.style.opacity = "1";
    reviewBtn.style.pointerEvents = "auto";
    reviewBtn.style.cursor = "pointer";
    reviewBtn.style.backgroundColor = "var(--blue)";
    reviewBtn.style.color = "#ffffff";
    reviewBtn.style.fontWeight = "400"; // Ou default pour Antigravity
    reviewBtn.style.boxShadow = "none";
    reviewBtn.onclick = () => renderErrorList();
  }
}

/**
 * Génère dynamiquement les blocs d'erreurs dans le panneau Antigravity
 */
function renderErrorList() {
  const panel = document.getElementById('error-review-panel');
  const errorContainer = document.getElementById('error-list-container');

  if (!errorContainer || !panel) return;

  showToast(`🧠 Analyse de tes ${lastQuizErrors.length} erreurs...`);

  errorContainer.innerHTML = lastQuizErrors.map(error => `
        <div class="error-block fade-in" style="background:#ffffff; padding:16px; border-radius: 20px; border:1px solid var(--red); box-shadow: var(--shadow-sm); margin-bottom: 16px;">
            <div class="error-block__question" style="font-weight:600; margin-bottom:12px; font-size:15px; color:var(--text-primary);">${error.question}</div>
            <div class="error-block__answer-group" style="font-size:14px; margin-bottom:8px; color:var(--red);">
                <span class="error-block__label" style="font-weight:700;">La réponse était :</span>
                <div class="error-block__correct-value" style="color:var(--green); font-weight:700;">${error.answer}</div>
            </div>
            ${error.detail ? `<div class="error-block__hint" style="font-size: 13px; color: var(--text-muted); margin-top: 8px;">💡 ${error.detail}</div>` : ''}
        </div>
    `).join('');

  if (window.renderMathInElement) {
    renderMathInElement(errorContainer, { delimiters: [{ left: "$", right: "$", display: false }] });
  }

  panel.style.display = 'flex';
  // Mettre un timeout pour s'assurer que le display flex est appliqué avant de scroller
  setTimeout(() => {
    errorContainer.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

// 2. RÉINITIALISATION POUR LE PROCHAIN QUIZ
function resetQuizState() {
  lastQuizErrors = [];
  const errorContainer = document.getElementById('error-list-container');
  if (errorContainer) errorContainer.innerHTML = '';
}

/**
 * Gère la fin de la session de quiz
 */
function handleSessionEnd(xpGain = 105) {
  if (typeof addXP === 'function') {
    updateNationalRank(xpGain);
  }
  updateReviewButton(currentQuizState.score);
  showToast(`🎉 Session terminée ! +${xpGain} XP`);
}



/**
 * Simule la progression du rang national (actuellement 12ème)
 */
function updateNationalRank(xpAdded) {
  // Logique simplifiée : tous les 500 XP gagnés en session, on gagne une place
  if (xpAdded >= 100) {
    const rankValueEl = document.querySelector('.rank-badge__value');
    if (rankValueEl) {
      // Animation de montée en rang
      rankValueEl.style.transition = 'transform 0.5s ease, color 0.5s ease';
      rankValueEl.style.color = 'var(--green)';
      rankValueEl.style.transform = 'translateY(-10px)';

      setTimeout(() => {
        rankValueEl.innerHTML = `11<sup>ème</sup>`;
        rankValueEl.style.transform = 'translateY(0)';
        rankValueEl.style.color = '#FFFFFF';
        showToast("📈 Bravo ! Tu viens de gagner une place au classement national.");
      }, 500);
    }
  }
}



function switchView(screenId) {
  // Cacher le hub et les écrans
  const hub = document.getElementById('training-hub');
  const flashcards = document.getElementById('flashcards-screen');
  const quiz = document.getElementById('quiz-screen');
  const qcm = document.getElementById('qcm-screen');

  if (hub) hub.style.display = 'none';
  if (flashcards) flashcards.style.display = 'none';
  if (quiz) quiz.style.display = 'none';
  if (qcm) qcm.style.display = 'none';

  if (screenId === 'hub') {
    if (hub) hub.style.display = 'block';
  } else {
    const screen = document.getElementById(screenId);
    if (screen) screen.style.display = 'flex';

    if (screenId === 'flashcards-screen') startFlashcardMode();
    else if (screenId === 'quiz-screen') startQuizMode();
    else if (screenId === 'qcm-screen') {
      startQcmMode();
      // LANCEMENT DE L'ANCRAGE À 12h30
      anchorLivePointAt1230();
      showToast("❄️ Vendredi 27 Février synchronisé (12h30).");
    }
  }
}

function closeQuizMode() {
  switchView('hub'); // Retour au Hub Entraînement
}

/* ============================================================
   PRAXIS — Ancrage Auto-Scroll 14h38
   ============================================================ */

/**
 * Scroll automatiquement vers le marqueur au chargement si défini.
 */
function anchorLivePointAt1438() {
  const pointer = document.querySelector('.live-center-marker') || document.getElementById('stitch-live-marker');
  if (!pointer) return;

  // Scrolling automatique vers le marqueur
  setTimeout(() => {
    pointer.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

/* ============================================================
   PRAXIS — Système de Modal Personnalisé (UI/UX)
   ============================================================ */

/**
 * Affiche le modal de confirmation Praxis
 * @param {Function} onConfirm - Action à exécuter si l'utilisateur quitte
 */
function showPraxisModal(onConfirm) {
  const modalOverlay = document.getElementById('praxis-modal-overlay');
  const confirmBtn = document.getElementById('praxis-modal-confirm');
  const cancelBtn = document.getElementById('praxis-modal-cancel');
  if (!modalOverlay) return;

  // Affichage du modal avec animation
  modalOverlay.style.display = 'flex';

  // Petit délai pour laisser le display se faire avant l'opacité
  requestAnimationFrame(() => requestAnimationFrame(() => {
    modalOverlay.classList.add('fade-in');
  }));

  // Action "Quitter"
  confirmBtn.onclick = () => {
    closePraxisModal();
    if (typeof onConfirm === 'function') onConfirm();
  };

  // Action "Annuler" ou clic sur l'overlay
  const closeAction = () => closePraxisModal();
  cancelBtn.onclick = closeAction;
  modalOverlay.onclick = (e) => {
    if (e.target === modalOverlay) closeAction();
  };
}

/**
 * Ferme le modal avec une petite transition
 */
function closePraxisModal() {
  const modalOverlay = document.getElementById('praxis-modal-overlay');
  if (!modalOverlay) return;
  modalOverlay.classList.remove('fade-in');
  setTimeout(() => {
    modalOverlay.style.display = 'none';
  }, 300);
}

// MISE À JOUR DE LA LOGIQUE D'ABANDON
function handleQuitQuiz() {
  // On appelle notre nouveau modal au lieu du confirm() natif
  showPraxisModal(() => terminateQuizSession());
}

function attemptQuizExit() {
  handleQuitQuiz();
}

/**
 * Arrête et réinitialise proprement la session de quiz
 */
function terminateQuizSession() {
  // 1. ARRÊT DU CHRONOMÈTRE
  if (window.quizTimer) {
    clearInterval(window.quizTimer);
    window.quizTimer = null;
  }
  if (typeof currentQuizState !== 'undefined' && currentQuizState.timerInterval) {
    clearInterval(currentQuizState.timerInterval);
  }

  // 2. NETTOYAGE DES VARIABLES
  if (typeof Trainer !== 'undefined' && Trainer.resetSession) {
    Trainer.resetSession();
  }
  resetQuizState();

  // 3. REDIRECTION
  switchView('hub');
  showToast("⚠️ Challenge abandonné.");
}

function closeErrorReviewPanel() {
  const panel = document.getElementById('error-review-panel');
  if (panel) panel.style.display = 'none';
}

/* ============================================================
   MODE FLASHCARDS (MÉMORISATION ACTIVE)
   ============================================================ */
const FLASHCARDS_DATA = [
  { q: "Quelle est la primitive de $f(x) = \\frac{1}{x}$ ?", a: "$\\ln(|x|) + C$" },
  { q: "Qu'est-ce que l'Effet Doppler ?", a: "Décalage de fréquence d'une onde dû au mouvement relatif de la source et de l'observateur." },
  { q: "Définition d'un anneau intègre ?", a: "Anneau commutatif unitaire non réduit à {0} sans diviseur de zéro." }
];

let currentCardIdx = 0;

function startFlashcardMode() {
  currentCardIdx = 0;
  loadFlashcard();
}

function loadFlashcard() {
  const cardData = FLASHCARDS_DATA[currentCardIdx];
  if (!cardData) {
    showToast("Session de flashcards terminée ! +50 XP");
    if (typeof addXP === 'function') addXP(50);
    switchView('hub');
    return;
  }

  const cardElement = document.getElementById('flashcardElement');
  cardElement.classList.remove('flipped');
  document.getElementById('flashcardActions').style.opacity = '0';
  document.getElementById('flashcardActions').style.pointerEvents = 'none';

  const qEl = document.getElementById('flashcardQuestion');
  const aEl = document.getElementById('flashcardAnswer');

  qEl.innerHTML = cardData.q;
  aEl.innerHTML = cardData.a;

  if (window.renderMathInElement) {
    renderMathInElement(qEl, { delimiters: [{ left: "$", right: "$", display: false }] });
    renderMathInElement(aEl, { delimiters: [{ left: "$", right: "$", display: false }] });
  }

  // Permettre le flip au clic
  cardElement.onclick = () => {
    cardElement.classList.add('flipped');
    document.getElementById('flashcardActions').style.opacity = '1';
    document.getElementById('flashcardActions').style.pointerEvents = 'auto';
    cardElement.onclick = null; // Désactiver le flip inverse pour forcer un choix
  };
}

function handleFlashcardResult(correct) {
  if (correct) {
    showToast("+5 XP");
    if (typeof addXP === 'function') addXP(5);
  }
  currentCardIdx++;
  loadFlashcard();
}

/* ============================================================
   MODE QCM (VALIDATION)
   ============================================================ */
const QCM_DATA = Array(10).fill(null).map((_, i) => ({
  question: `Question théorique ${i + 1} : Soit $M$ une matrice telle que $M^2 = M$. $M$ est-elle :`,
  options: ["Inversible", "Nilpotente", "Un projecteur", "Une symétrie"],
  correctInd: 2
}));

function startQcmMode() {
  const list = document.getElementById('qcmList');
  list.innerHTML = '';

  QCM_DATA.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'qcm-item';

    let html = `<div class="qcm-question">${q.question}</div><div class="qcm-options">`;
    q.options.forEach((opt, oIdx) => {
      html += `<button class="qcm-option" onclick="selectQcmOption(this, ${idx})">${opt}</button>`;
    });
    html += `</div>`;

    item.innerHTML = html;
    list.appendChild(item);
  });

  if (window.renderMathInElement) {
    renderMathInElement(list, { delimiters: [{ left: "$", right: "$", display: false }] });
  }
}

function selectQcmOption(btn, qIdx) {
  const container = btn.parentElement;
  container.querySelectorAll('.qcm-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function validateQCM() {
  document.getElementById('qcmResultOverlay').style.display = 'flex';
  if (typeof addXP === 'function') addXP(50);
}

/* ============================================================
   PRAXIS — Moteur de Fusion Colloscope & Planning (Expert)
   ============================================================ */

/**
 * Analyse enrichie du scanner pour détecter le Colloscope
 */
function smartScheduleAnalysis(fileContent) {
  const text = fileContent.toLowerCase();

  // 1. DÉTECTION MULTI-FORMAT
  if (text.includes('semaine') || text.includes('colloscope') || text.includes('trinôme') || true) {
    showToast("🧠 Mode 'Analyse Colloscope' activé...");
    setTimeout(() => processColloscope(text), 1500);
  } else {
    showToast("📅 Emploi du temps classique détecté.");
  }
}

/**
 * Traitement spécifique du Colloscope pour Henri (Groupe 1)
 */
function processColloscope(rawText) {
  // 2. IDENTIFICATION UTILISATEUR
  const user = { name: "Henri", group: 1 };

  // 3. MAPPING TEMPOREL & TRADUCTION DES CODES
  // Simulation du mapping (Date réelle : 26 Février 2026 -> Semaine X)
  const weekMapping = { current: "Semaine 22" };
  const codes = { 'M': 'Maths', 'SR': 'S. Richard', '6': 'Mercredi 17h30' };

  const event = {
    title: `Colle de ${codes['M']}`,
    details: `Jury : ${codes['SR']}`,
    time: codes['6'],
    isHighStake: true
  };

  showToast(`✅ Colloscope analysé pour ${user.name} (G${user.group})`);

  // 4. FUSION & 5. INTELLIGENCE (SUPERPOSITION)
  setTimeout(() => injectSmartBlocks(event), 1500);
}

/**
 * Injecte les événements et les blocs de révision intelligents
 */
function injectSmartBlocks(event) {
  // Ciblage du conteneur de timeline existant sur le Dashboard
  const timeline = document.getElementById('dailyTimeline') || document.getElementById('timelineContainer');
  if (!timeline) return;

  // Bloc de la Colle
  const eventHTML = `
        <div class="planning-event high-stake">
            <div class="event-time">${event.time}</div>
            <div class="event-info">
                <strong>${event.title}</strong>
                <span>${event.details}</span>
            </div>
            <div class="event-badge">🎯 Priorité</div>
        </div>
    `;

  // BLOCS INTELLIGENTS : Si DS de Maths le Samedi
  // (Simulation de détection de DS dans l'image)
  const revisionIntenseHTML = `
        <div class="planning-event intense-revision">
            <div class="event-time">Jeu. & Ven. (18h-21h)</div>
            <div class="event-info">
                <strong>Révision Intense : DS Maths</strong>
                <span>Focus : Espaces Vectoriels & Séries</span>
            </div>
            <div class="event-badge">🔥 Deep Work</div>
        </div>
    `;

  // La fusion respecte l'emploi du temps existant et vient s'y superposer avant les anciens éléments
  timeline.innerHTML = eventHTML + revisionIntenseHTML + timeline.innerHTML;

  if (typeof addXP === 'function') addXP(100);
  showToast("🚀 Planning mis à jour avec tes sessions de Deep Work.");
}

function selectQcmOption(btn, qIdx) {
  const container = btn.parentElement;
  container.querySelectorAll('.qcm-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

function validateQCM() {
  const list = document.getElementById('qcmList');
  const allAnswered = [...list.querySelectorAll('.qcm-options')].every(opts => opts.querySelector('.selected'));

  if (!allAnswered) {
    showToast("Veuillez répondre à toutes les questions !");
    return;
  }

  showToast("QCM Validé ! +100 XP ✨");
  if (typeof addXP === 'function') addXP(100);

  // Remplir la jauge du hub d'entraînement (simulé)
  const fill = document.querySelector('.training-goal__fill');
  const progressText = document.querySelector('.training-goal__progress');
  if (fill && progressText) {
    fill.style.width = '66%';
    progressText.textContent = '2/3 terminé';
  }

  setTimeout(() => switchView('hub'), 1500);
}

/* ============================================================
   PRAXIS — Fusion Réaliste Planning & Colloscope (Henri G1)
   ============================================================ */

/* ============================================================
   PRAXIS — Timeline de Précision & Point Live
   ============================================================ */

/**
 * Calcule et positionne le Point Live sur la timeline
 */
function updateLivePointer() {
  const pointer = document.getElementById('livePointer');
  const timeline = document.getElementById('timelineContainer') || document.getElementById('dailyTimeline');
  if (!pointer || !timeline) return;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  if (hours >= 7 && hours <= 22 && (hours > 7 || minutes >= 30)) {
    const posVal = ((hours - 7.5) * 80) + (minutes * (80 / 60));
    pointer.style.top = `${posVal}px`;

    // Scrolling automatique vers le point live
    setTimeout(() => {
      pointer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    // Activer la carte courante (pour Global Focus)
    const blocks = timeline.querySelectorAll('.timeline-block');
    blocks.forEach(b => {
      const topStr = b.style.top;
      const heightStr = b.style.height;
      if (topStr && heightStr) {
        const t = parseFloat(topStr);
        const h = parseFloat(heightStr);
        if (posVal >= t && posVal <= (t + h)) {
          b.classList.add('is-active');
        } else {
          b.classList.remove('is-active');
        }
      }
    });

  } else {
    pointer.style.display = 'none';
  }
}

/**
 * Active/Désactive l'assombrissement de l'écran (Focus Mode)
 */
function toggleTimelineFocus(e) {
  if (e) e.stopPropagation();
  document.body.classList.toggle('timeline-focus-active');
  const btn = document.getElementById('focusTimelineBtn');
  if (btn) btn.classList.toggle('active');
}

/**
 * Génère le planning complet avec toutes les données de la journée (Mode Fixe)
 */
/* ============================================================
   PILOTAGE PRAXIS : VENDREDI 27 FÉV. (CLARITÉ MAXIMALE)
   ============================================================ */

// 1. DATA SOURCES AVEC OPACITÉ 70% POUR LE PASSÉ
const whiteHenriData = [
  { start: '08:10', title: 'Français-Philo', prof: 'T. Payen', room: 'B130', status: 'past' },
  { start: '10:15', title: 'S.I. Matin', prof: 'B. Ripoche', room: 'B130', status: 'past' },
  { start: '12:05', title: 'PAUSE DÉJEUNER', prof: 'Repos', room: 'Cafétéria', status: 'past' },
  { start: '13:15', title: 'TP S.I.', prof: 'B. Ripoche', room: 'D022', status: 'past' },
  { start: '15:50', title: 'TP PHYSIQUE', prof: 'B. Lelu', room: 'B011', status: 'active' }
];

// 2. STYLES AFFINÉS
const whiteExpertStyles = `
<style>
    body { background-color: #FFFFFF !important; color: #000000; }
    .header-white-xl { font-size: 28px; font-weight: 900; color: #000000; margin-bottom: 16px; }
    
    .timeline-rail-white { position: absolute; left: 30px; top: 0; bottom: 0; width: 2px; background: #F1F5F9; }
    
    .card-pure-white { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 14px; padding: 22px; margin-bottom: 12px; }
    
    /* Augmenté à 75% pour la lisibilité */
    .card-past-gray { opacity: 0.75; border-color: #E2E8F0; filter: none; } 
    
    /* Gris plus soutenu */
    .text-past { color: #64748B !important; } 
    
    .title-black-bold { color: #000000; font-weight: 900; font-size: 19px; text-transform: uppercase; letter-spacing: -0.5px; }
    .meta-anthracite { color: #475569; font-size: 13px; font-weight: 600; }
    
    .live-pointer-center { position: absolute; left: 0px; display: flex; align-items: center; gap: 8px; z-index: 100; transform: translateX(-15px); }
    .dot-red-pulse { width: 10px; height: 10px; background: #EF4444; border-radius: 50%; box-shadow: 0 0 12px rgba(239, 68, 68, 0.4); margin-left: 50px; }
    .time-red-label { color: #EF4444; font-weight: 900; font-size: 15px; }
</style>`;
document.head.insertAdjacentHTML('beforeend', whiteExpertStyles);

/* ============================================================
   CLEAN RESET PRAXIS : VENDREDI 27 FÉV. (STRUCTURE FLEX)
   ============================================================ */

/* ============================================================
   CLEAN RESET PRAXIS : VENDREDI 27 FÉV. (STRUCTURE FLEX)
   ============================================================ */

const cleanStyles = `
<style>
    /* Reset & Header Absolute */
    .praxis-header-absolute { 
        position: relative; 
        width: 100%; 
        min-height: 130px; /* Surélévation pour éviter le chevauchement (108px outils + 20px marge) */
        background: #FFF; 
        padding: 20px 0; 
        z-index: 30; 
    }
    .date-label-black { font-size: 21px; font-weight: 800; color: #000; margin-left: 20px; letter-spacing: -0.025em; line-height: 45px; }
    
    /* Tools Group (Collier d'Outils - Top Right) */
    .tools-absolute-group { 
        position: absolute; 
        top: 10px; 
        right: 10px; 
        display: flex; 
        flex-direction: column; 
        gap: 8px; 
        align-items: flex-end; 
    }
    
    /* Bouton Pilule Base */
    .tool-pill-base {
        height: 45px;
        border-radius: 9999px;
        padding: 0 20px;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        font-weight: 800; font-size: 13px; letter-spacing: 0.05em;
        cursor: pointer; transition: all 0.2s ease;
        position: relative;
    }
    
    /* Pilules Indigo Unifiées (Scanner & PDF) */
    .scanner-pill-btn, .pdf-pill-btn {
        background: rgba(99, 102, 241, 0.12); /* bg-indigo-glow/20 ~ */
        border: 1px solid rgba(99, 102, 241, 0.3);
        color: #6366F1;
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15); /* lueur surélévation */
    }
    
    .scanner-pill-btn { z-index: 20; }
    .pdf-pill-btn { z-index: 10; margin-top: 0; }
    
    .scanner-pill-btn:hover, .pdf-pill-btn:hover { 
        background: rgba(99, 102, 241, 0.2); 
        border-color: rgba(99, 102, 241, 0.5);
        box-shadow: 0 0 15px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(99, 102, 241, 0.1); /* active-glow */
    }
    
    .scanner-pill-btn:active, .pdf-pill-btn:active { transform: scale(0.98); }
    .scanner-icon-blue { font-size: 20px; }
    
    /* Cache Forcé */
    input[type="file"] { display: none !important; appearance: none; opacity: 0; position: absolute; pointer-events: none; }
    
    /* Timeline (Ancrée à 70px) */
    .timeline-rail-clean { position: absolute; left: 70px; top: 0; bottom: 0; width: 2px; background: #E2E8F0; }
    
    .live-time-red-clean { 
        position: absolute; 
        left: 0; 
        top: 240px; /* Position ajustée pour 12:40 */
        width: 100%; 
        pointer-events: none;
        z-index: 20;
    }
    
    .live-time-text {
        position: absolute;
        right: calc(100% - 60px); /* 10px d'écart avec la ligne à 70px */
        top: -2px; /* Centrage visuel avec le point */
        color: #EF4444; 
        font-weight: 900; 
        font-size: 11px;
    }
    
    .live-pulse-dot {
        position: absolute;
        left: 71px; /* Centre exact de la ligne (70px + 1px) */
        top: 0;
        transform: translateX(-50%);
        width: 10px; 
        height: 10px; 
        background: #EF4444; 
        border-radius: 50%; 
        box-shadow: 0 0 0 6px rgba(239, 68, 68, 0.15); /* halo-red discreet */
        animation: pulse-slow 3s infinite ease-in-out;
    }
    
    @keyframes pulse-slow {
        0%, 100% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1); }
        50% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0.25); }
    }

    /* AI Control Bar */
    .ai-control-bar {
        margin-left: 120px;
        padding: 10px 16px;
        background: rgba(99, 102, 241, 0.05); /* bg-indigo-glow/5 */
        border: 1px dashed rgba(99, 102, 241, 0.4);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        position: relative;
    }
    .ai-control-badge {
        background: #FFFFFF;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        border-radius: 9999px;
        padding: 4px 12px;
        font-weight: 800; font-size: 12px; color: #1E293B;
        cursor: pointer; transition: transform 0.1s ease;
    }
    .ai-control-badge:active { transform: scale(0.95); }
    .ai-control-btn {
        background: #6366F1;
        color: white;
        border-radius: 8px;
        padding: 6px 12px;
        display: flex; align-items: center; gap: 6px;
        font-weight: 800; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
        cursor: pointer; transition: background 0.2s ease, transform 0.1s ease;
    }
    .ai-control-btn:hover { background: #4F46E5; }
    .ai-control-btn:active { transform: scale(0.95); }

    /* Cartes Cours - Base Premium Light */
    .praxis-course-card {
        margin-left: 120px; /* Délimite le nouveau couloir immense (+35px) */
        padding: 24px 20px; 
        background: linear-gradient(to right, #F8FAFC, #FFFFFF);
        border: 1px solid #E2E8F0; 
        border-radius: 12px;
        opacity: 1 !important;
        position: relative;
        overflow: hidden;
    }
    
    .card-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    /* Variantes de Couleurs & Glow (Mode Light) */
    .card-si {
        border-left: 4px solid #6366F1; /* Indigo Stitch Exact */
    }
    .card-physique {
        border-left: 4px solid #64748B; /* Gris Acier */
    }
    
    /* La classe active-glow renforcée pour S.I */
    .active-glow {
        box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4), inset 0 0 10px rgba(99, 102, 241, 0.05);
        border: 1px solid rgba(99, 102, 241, 0.5);
    }
    
    /* Ombre de flottaison "Premium Float" pour TOUS les autres cours */
    .inactive-shadow {
        box-shadow: 0 4px 14px -2px rgba(100, 116, 139, 0.15); 
    }

    /* Typographie des cartes */
    .praxis-card-title {
        opacity: 1 !important;
        color: #000000 !important;
        font-weight: 900;
        text-transform: uppercase;
        font-size: 18px;
        line-height: 1.25;
        margin-bottom: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .praxis-card-info {
        color: #64748B !important;
        font-size: 13px;
        font-weight: 700;
    }
    
    /* Icônes Déco Droite */
    .card-deco-icon {
        color: #CBD5E1; /* Gris clair */
        font-size: 32px;
    }
    
    /* Badge 'EN COURS' Stitch Premium */
    .bg-indigo-glow {
        background-color: #6366F1;
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        color: #FFFFFF;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 999px;
        letter-spacing: 0.05em;
        animation: pulse-glow 2s infinite;
    }
    
    @keyframes pulse-glow {
        0%, 100% {
            box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
        }
        50% {
            box-shadow: 0 0 18px rgba(99, 102, 241, 0.8);
        }
    }
</style>`;
document.head.insertAdjacentHTML('beforeend', cleanStyles);

function renderCleanPraxis() {
  const container = document.getElementById('timelineContainer');
  if (!container) return;

  container.innerHTML = `
        <div class="w-full h-full bg-[#FFFFFF] flex flex-col relative overflow-hidden">
            <!-- HEADER NEUF -->
            <header class="praxis-header-absolute">
                <h1 class="date-label-black">Vendredi 27 Fév.</h1>
                
                <div class="tools-absolute-group">
                    <div class="tool-pill-base scanner-pill-btn" onclick="document.getElementById('hiddenFileInput').click()">
                        <span class="material-symbols-outlined">description</span>
                        <span>SCANNER</span>
                    </div>

                    <button id="btnExportDayTop" class="tool-pill-base pdf-pill-btn">
                        <span class="material-symbols-outlined text-[#6366F1] text-[22px]">download</span>
                        <span>PDF</span>
                    </button>
                </div>
                <input type="file" id="hiddenFileInput" accept="image/*, .pdf" />
            </header>

            <!-- SCROLL ZONE & TIMELINE AREA -->
            <div class="flex-1 overflow-y-auto w-full pb-24 no-scrollbar relative pl-[40px] pr-6 pt-4">
                <div class="timeline-rail-clean" style="top: 48px;"></div>
                
                <!-- LIVE MARKER 13:06 -->
                <div class="live-time-red-clean" style="top: 250px;">
                    <span class="live-time-text">13:06</span>
                    <div class="live-pulse-dot"></div>
                </div>

                <!-- COURS (Styles "Stitch Premium Light") -->
                <div class="flex flex-col gap-5 mt-2 mb-8 relative z-10 w-full">
                    
                    <!-- MATINÉE: PASSÉ (Estompé) -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">08:10</div>
                        <div class="praxis-course-card inactive-shadow opacity-50 grayscale">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title text-slate-400">Français-Philo</h2>
                                    <p class="praxis-card-info">08:10 — 10:05 | T. Payen • B204</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon">menu_book</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">10:15</div>
                        <div class="praxis-course-card card-si inactive-shadow opacity-50 grayscale">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title text-slate-400">S.I. Matin</h2>
                                    <p class="praxis-card-info">10:15 — 12:05 | Salle D022</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon">settings_suggest</span>
                            </div>
                        </div>
                    </div>

                    <!-- PAUSE DÉJEUNER -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">12:05</div>
                        <div class="praxis-course-card" style="background: transparent; border: 1px dashed #CBD5E1; box-shadow: none;">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title text-slate-500" style="font-size: 14px;">Pause Déjeuner</h2>
                                    <p class="praxis-card-info">12:05 — 13:15 | 🍴 Buffet Stratégique</p>
                                </div>
                                <span class="material-symbols-outlined text-slate-400 text-2xl">restaurant</span>
                            </div>
                        </div>
                    </div>

                    <!-- SCIENCES DE L'INGÉNIEUR (Active Glow) -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-indigo-500">13:15</div>
                        <div class="praxis-course-card card-si active-glow">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title">
                                        Sciences de l'Ingénieur
                                        <span class="bg-indigo-glow">EN COURS</span>
                                    </h2>
                                    <p class="praxis-card-info">13:15 — 15:35 | Salle D022</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon">settings_suggest</span>
                            </div>
                            
                            <!-- Barre de Progression -->
                            <div class="mt-4 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div class="h-full bg-[#6366F1] w-[45%] rounded-full shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- PHYSIQUE (Inactive Shadow) -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">15:50</div>
                        <div class="praxis-course-card card-physique inactive-shadow">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title">Physique</h2>
                                    <p class="praxis-card-info">15:50 — 17h40 | Salle B011</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon">science</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- BARRE DE CONTRÔLE IA -->
                    <div class="relative w-full mt-2 mb-2">
                        <div class="absolute right-[100%] top-[12px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">18:15</div>
                        <div class="ai-control-bar">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-slate-400 text-[18px]">tune</span>
                                <span class="text-slate-500 font-bold text-[10px] tracking-wider uppercase">Objectif du soir</span>
                            </div>
                            
                            <div class="ai-control-badge">
                                <span>⏱️ 2h30</span>
                            </div>
                            
                            <div class="ai-control-btn">
                                <span class="material-symbols-outlined text-[16px]">auto_awesome</span>
                                <span>Optimiser</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- RÉVISION PERSONNELLE (Soirée Focus - Dynamic AI) -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">19:00</div>
                        <div class="praxis-course-card inactive-shadow" style="border-left: 4px solid #6366F1;">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title text-[#000000] uppercase tracking-wide">RÉVISION PERSONNELLE</h2>
                                    <p class="praxis-card-info">Généré selon vos objectifs</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon text-indigo-500">auto_awesome</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- SESSION INTENSIVE (Soirée Focus - Dynamic AI) -->
                    <div class="relative w-full">
                        <div class="absolute right-[100%] top-[24px] w-[50px] pr-[14px] text-right text-[11px] font-bold text-slate-400">20:30</div>
                        <div class="praxis-course-card inactive-shadow" style="border-left: 4px solid #6366F1;">
                            <div class="card-top-row">
                                <div>
                                    <h2 class="praxis-card-title text-[#000000] uppercase tracking-wide">SESSION INTENSIVE</h2>
                                    <p class="praxis-card-info">Généré selon vos objectifs</p>
                                </div>
                                <span class="material-symbols-outlined card-deco-icon text-indigo-500">auto_awesome</span>
                            </div>
                        </div>
                    </div>
                </div> <!-- FIN DES COURS VENDREDI -->
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('.timeline-container') || document.querySelector('.planning-dashboard')) {
    renderCleanPraxis();
  }

  // Hook export PDF
  const exportBtn = document.getElementById('btnExportDay');
  if (exportBtn) {
    exportBtn.onclick = () => {
      showToast("🖨️ Préparation du PDF...");
      setTimeout(() => window.print(), 800);
    };
  }
});

/* ============================================================
   PRAXIS — Mode Focus Automatique (Cerveau de l'App)
   ============================================================ */

/**
 * Surveille la proximité d'un événement majeur (Colle/DS)
 */
function checkFocusTriggers() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();

  // Déclencher 4 minutes avant la Colle de 17h30
  if (currentHour === 17 && currentMin === 26) {
    activateAutomaticFocus();
  }
}

/**
 * Variables globales pour le Focus Progressif
 */
let focusStartTime = null;
let focusTimerInterval = null;

/**
 * Bascule MANUELLE du mode Focus (Bouton Cible / Lune)
 */
function toggleTimelineFocus(e) {
  if (e) e.stopPropagation();
  const body = document.body;
  const isFocusActive = body.classList.contains('timeline-focus-active');

  if (!isFocusActive) {
    // Activer
    body.classList.add('timeline-focus-active');
    const btn = document.getElementById('focusTimelineBtn');
    if (btn) btn.classList.add('active');

    focusStartTime = Date.now();
    startFocusTracker();
    showToast("🔕 Mode Focus : Notifications désactivées. Travail profond en cours.");
  } else {
    // Désactiver
    body.classList.remove('timeline-focus-active');
    const btn = document.getElementById('focusTimelineBtn');
    if (btn) btn.classList.remove('active');

    stopFocusTracker();
    showToast("🔔 Fin du mode Focus. Rapport de concentration généré.");
  }
}

/**
 * Active le Mode Focus AUTOMATIQUE sur le téléphone avec overlay
 */
function activateAutomaticFocus() {
  const focusOverlay = document.getElementById('focusModeOverlay');
  const isFocusActive = window.state ? window.state.isFocusModeActive : false;

  if (!focusOverlay || isFocusActive) return;

  if (window.state) {
    window.state.isFocusModeActive = true;
  }

  showToast("🔇 Mode Concentration activé automatiquement.");

  // 1. UI : Affichage de l'overlay de concentration
  focusOverlay.classList.add('active');

  // 2. LOGIQUE SYSTÈME (Simulée)
  // Bloquer les notifications et passer en mode sombre intense
  document.body.classList.add('dark-focus-mode');

  // 3. XP BONUS : Récompense pour le Deep Work
  if (typeof addXP === 'function') addXP(25);

  // 4. CHRONOMÈTRE DE CONCENTRATION Progressif
  focusStartTime = Date.now();
  startFocusTracker();
}

/**
 * Désactive le Mode Focus Automatique manuellement
 */
function deactivateFocusMode() {
  const focusOverlay = document.getElementById('focusModeOverlay');
  if (focusOverlay) {
    focusOverlay.classList.remove('active');
  }

  document.body.classList.remove('dark-focus-mode');

  if (window.state) {
    window.state.isFocusModeActive = false;
  }

  stopFocusTracker();
  showToast("✅ Mode Concentration terminé. Bravo !");
}

/**
 * Lance le tracker progressif de concentration
 */
function startFocusTracker() {
  if (focusTimerInterval) clearInterval(focusTimerInterval);

  focusTimerInterval = setInterval(() => {
    const elapsed = Date.now() - focusStartTime;
    const seconds = Math.floor((elapsed / 1000) % 60);
    const minutes = Math.floor((elapsed / 1000 / 60) % 60);
    const hours = Math.floor(elapsed / 1000 / 3600);

    // Format : HHh MMm SSs (si HH > 0) ou juste MMm SSs
    const timeStr = `${hours > 0 ? hours + 'h ' : ''}${minutes < 10 ? '0' + minutes : minutes}:${seconds < 10 ? '0' + seconds : seconds} `;

    // Mise à jour de l'overlay si visible
    const timerDisplay = document.getElementById('focusTimerDisplay');
    if (timerDisplay) timerDisplay.textContent = timeStr;
  }, 1000);
}

/**
 * Arrête le chronomètre de focus
 */
function stopFocusTracker() {
  if (focusTimerInterval) {
    clearInterval(focusTimerInterval);
    focusTimerInterval = null;
  }
}

/**
 * Désactive le Mode Focus manuellement ou à la fin du timer
 */
function deactivateFocusMode() {
  const focusOverlay = document.getElementById('focusModeOverlay');
  if (focusOverlay) {
    focusOverlay.classList.remove('active');
  }

  document.body.classList.remove('dark-focus-mode');

  if (window.state) {
    window.state.isFocusModeActive = false;
  }

  showToast("✅ Mode Concentration terminé. Bravo !");
}

function startFocusTimer(minutes) {
  let seconds = minutes * 60;
  const timerDisplay = document.getElementById('focusTimerDisplay');

  const interval = setInterval(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (timerDisplay) timerDisplay.textContent = `${m}:${s < 10 ? '0' + s : s} `;

    if (seconds <= 0) {
      clearInterval(interval);
      deactivateFocusMode();
    }
    seconds--;
  }, 1000);
}

// On vérifie toutes les minutes si un créneau important approche
setInterval(checkFocusTriggers, 60000);
