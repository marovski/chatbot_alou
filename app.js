// externalized JS from index.html

// 1. STATE MANAGEMENT & SESSION PERSISTENCE (SAFE VERSION)
let conversationState = {
    step: 'welcome',
    userData: {},
    existingComplaint: false,
    category: null,
    critical: false,
    protocol: null
};
const SESSION_KEY = 'alou_cvt_session';

// structured messages storage (safer than storing raw innerHTML)
let messages = [];

function saveSession() {
    try {
        const sessionData = {
            state: conversationState,
            messages: messages,
            statusText: document.getElementById('sessionStatus').textContent,
            badgeClass: document.getElementById('statusBadge').className,
            badgeText: document.getElementById('statusBadge').textContent
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
        console.warn("Armazenamento de sessão bloqueado pelo navegador.");
    }
}

function clearSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (error) {}
    location.reload();
}

// 2. MOCK API SERVICES
const mockAPI = {
    authenticate: async (type, value) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() < 0.1) {
                    reject(new Error("Timeout na ligação ao CRM (Siebel)."));
                } else {
                    resolve({ name: "Cliente Registado", hasExisting: Math.random() < 0.3 });
                }
            }, 1500);
        });
    },
    createTicket: async (data) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() < 0.1) {
                    reject(new Error("Falha ao gravar a reclamação no sistema central."));
                } else {
                    resolve(`RCL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`);
                }
            }, 2000);
        });
    }
};

// 3. NLP / KEYWORD ANALYSIS
const analyzeCriticality = (text) => {
    const criticalKeywords = [
        'arme', 'advogado', 'cancelar', 'tribunal', 'urgente',
        'polícia', 'processo', 'rescisão', 'jurídico',
        'rescindir', 'ação', 'litígio', 'contencioso', 'resolução civil',
        'matar', 'assassinar', 'ameaça', 'violência', 'agressão'
    ];
    const lowerText = text.toLowerCase();
    return criticalKeywords.some(keyword => lowerText.includes(keyword));
};

// UI Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sessionStatus = document.getElementById('sessionStatus');
const statusBadge = document.getElementById('statusBadge');

// Categories Configuration (include explicit `name` for safe display)
// labelText is the safe plain text; labelHtml is optional trusted HTML used only when trustedHtml=true
const categories = [
    { id: 'faturacao', name: 'Faturação', labelText: 'Faturação - Problemas com faturas ou cobranças', labelHtml: '💳 Faturação - <small>Problemas com faturas ou cobranças</small>', trustedHtml: true },
    { id: 'sinal', name: 'Qualidade de Sinal', labelText: 'Qualidade de Sinal - Internet lenta ou sem conexão', labelHtml: '📶 Qualidade de Sinal - <small>Internet lenta ou sem conexão</small>', trustedHtml: true },
    { id: 'tecnico', name: 'Apoio Técnico', labelText: 'Apoio Técnico - Problemas com equipamentos', labelHtml: '🔧 Apoio Técnico - <small>Problemas com equipamentos</small>', trustedHtml: true },
    { id: 'atendimento', name: 'Atendimento', labelText: 'Atendimento - Questões de serviço ao cliente', labelHtml: '👤 Atendimento - <small>Questões de serviço ao cliente</small>', trustedHtml: true },
    { id: 'outro', name: 'Outro', labelText: 'Outro - Outras situações', labelHtml: '📋 Outro - <small>Outras situações</small>', trustedHtml: true }
];

// Utility Functions
function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Validation helper for identification inputs
function validateIdentification(type, value) {
    if (!type || !value) return false;
    const v = value.trim();
    const validationRules = {
        nif: {
            pattern: /^[0-9]{7}$/,
            message: 'NIF deve conter exatamente 7 dígitos (ex: 1234567)'
        },
        conta: {
            pattern: /^[0-9]{6,12}$/,
            message: 'Conta deve conter entre 6 e 12 dígitos (ex: 123456789)'
        },
        telemovel: {
            pattern: /^[0-9]{7}$/,
            message: 'Telemóvel deve conter exatamente 7 dígitos (ex: 9912345)'
        },
        default: {
            pattern: /.{3,}/,
            message: 'Valor deve ter pelo menos 3 caracteres'
        }
    };
    
    const rule = validationRules[type] || validationRules.default;
    conversationState.lastValidationError = rule.message;
    return rule.pattern.test(v);
}

// --- METRICS & DYNAMIC KPIs ---
const defaultKPIs = {
    containmentDisplay: '72%',
    tmrDisplay: '2.5min',
    npsDisplay: '43',
    availDisplay: '24/7'
};

function initMetrics() {
    conversationState.metrics = conversationState.metrics || {
        sessionsStarted: 0,
        handledByBot: 0,
        transferredToHuman: 0,
        totalResolutionTimeMs: 0,
        resolvedCount: 0,
        npsScores: []
    };

    // If persisted values exist, they will be used. Ensure UI shows current values.
    updateKpis();
}

function updateKpis() {
    const m = conversationState.metrics || {};

    // Containment rate: handledByBot / (handledByBot + transferredToHuman)
    const handled = m.handledByBot || 0;
    const transferred = m.transferredToHuman || 0;
    const denom = handled + transferred;
    const containmentEl = document.getElementById('kpiContainment');
    if (containmentEl) {
        if (denom === 0) containmentEl.textContent = defaultKPIs.containmentDisplay;
        else containmentEl.textContent = `${Math.round((handled / denom) * 100)}%`;
    }

    // TMR average in minutes
    const tmrEl = document.getElementById('kpiTmr');
    if (tmrEl) {
        if ((m.resolvedCount || 0) === 0) tmrEl.textContent = defaultKPIs.tmrDisplay;
        else {
            const avgMin = (m.totalResolutionTimeMs / (m.resolvedCount * 60000));
            tmrEl.textContent = `${avgMin.toFixed(1)}min`;
        }
    }

    // NPS calculation (promoters - detractors)
    const npsEl = document.getElementById('kpiNps');
    if (npsEl) {
        const scores = (m.npsScores || []);
        if (scores.length === 0) npsEl.textContent = defaultKPIs.npsDisplay;
        else {
            const promoters = scores.filter(s => s >= 9).length;
            const detractors = scores.filter(s => s <= 6).length;
            const nps = Math.round(((promoters - detractors) / scores.length) * 100);
            npsEl.textContent = `${nps}`;
        }
    }

    // Availability remains static for now
    const availEl = document.getElementById('kpiAvail');
    if (availEl) availEl.textContent = defaultKPIs.availDisplay;
}

function startSessionTimer() {
    if (!conversationState.sessionStartTime) conversationState.sessionStartTime = Date.now();
}

function endSessionTimer(resolvedByBot = false) {
    if (!conversationState.sessionStartTime) return;
    const duration = Date.now() - conversationState.sessionStartTime;
    conversationState.sessionStartTime = null;
    const m = conversationState.metrics;
    if (!m) return;
    if (resolvedByBot) {
        m.handledByBot = (m.handledByBot || 0) + 1;
        m.resolvedCount = (m.resolvedCount || 0) + 1;
        m.totalResolutionTimeMs = (m.totalResolutionTimeMs || 0) + duration;
    }
    // update UI and persist
    updateKpis();
    saveSession();
}

function recordTransferToHuman() {
    const m = conversationState.metrics;
    if (!m) return;
    m.transferredToHuman = (m.transferredToHuman || 0) + 1;
    updateKpis();
    saveSession();
}

function recordSatisfaction(optionId) {
    const mapping = { great: 10, good: 8, ok: 6, bad: 3 };
    const score = mapping[optionId];
    if (score === undefined) return;
    const m = conversationState.metrics;
    if (!m) return;
    m.npsScores.push(score);
    // Calculate and log NPS immediately after recording satisfaction
    const promoters = (m.npsScores || []).filter(s => s >= 9).length;
    const detractors = (m.npsScores || []).filter(s => s <= 6).length;
    const nps = m.npsScores.length > 0 ? Math.round(((promoters - detractors) / m.npsScores.length) * 100) : 0;
    console.log(`NPS Updated: ${nps} (Promoters: ${promoters}, Detractors: ${detractors}, Total: ${m.npsScores.length})`);
    updateKpis();
    saveSession();
}


function updateSessionStatus(status, badge = 'pending') {
    sessionStatus.textContent = status;
    statusBadge.className = `status-badge ${badge}`;
    statusBadge.textContent = badge === 'active' ? 'Concluído' : (badge === 'error' ? 'Erro' : 'Em Progresso');
    saveSession();
}

function showTyping() {
    if (document.getElementById('typing')) return; // avoid duplicates
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot';
    typingDiv.id = 'typing';
    typingDiv.innerHTML = `<div class="typing-indicator active"><span></span><span></span><span></span></div>`;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
}

function hideTyping() {
    const typing = document.getElementById('typing');
    if (typing) typing.remove();
}

function addMessage(text, isUser = false, options = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'message-bubble';
    bubbleDiv.setAttribute('role','article');
    bubbleDiv.setAttribute('aria-label', isUser ? 'Mensagem do utilizador' : 'Mensagem do assistente');

    // sanitize user messages to avoid XSS
    if (isUser) bubbleDiv.textContent = text;
    else bubbleDiv.innerHTML = text; // bot messages are trusted in this prototype

    if (options) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options';
        optionsDiv.setAttribute('role', 'list');
        options.forEach((option, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.setAttribute('role', 'option');
            // render safe labelText by default
            if (option.labelText) btn.textContent = option.labelText;
            else if (option.label) btn.textContent = option.label; // fallback
            // if content is explicitly trusted, render labelHtml (only for known internal sources)
            if (option.trustedHtml && option.labelHtml) btn.innerHTML = option.labelHtml;
            btn.setAttribute('aria-label', `Opção: ${option.labelText || option.label || option.id}`);

            btn.addEventListener('click', (e) => {
                optionsDiv.querySelectorAll('.option-btn:not(:disabled)').forEach(b => b.disabled = true);
                if (window.handleOptionClick) window.handleOptionClick(option.id, option.labelText || option.label || option.id);
            });

            // keyboard navigation: arrow keys and enter/space activation
            btn.addEventListener('keydown', (e) => {
                const focusable = Array.from(optionsDiv.querySelectorAll('.option-btn'));
                const idx = focusable.indexOf(e.currentTarget);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = focusable[(idx + 1) % focusable.length];
                    next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = focusable[(idx - 1 + focusable.length) % focusable.length];
                    prev.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.click();
                }
            });

            optionsDiv.appendChild(btn);
            // focus the first option for quick keyboard access
            // make all options keyboard-focusable via Tab
            btn.tabIndex = 0;
        });
        bubbleDiv.appendChild(optionsDiv);
        // after appending, focus first available option button
        setTimeout(() => {
            const first = optionsDiv.querySelector('.option-btn:not(:disabled)');
            if (first) first.focus();
        }, 50);
    }

    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();

    // persist structured message
    messages.push({ sender: isUser ? 'user' : 'bot', text: text, isHtml: !isUser, options: options || null, timestamp: Date.now() });
    saveSession();
}

// 4. CORE LOGIC & FLOW CONTROL
window.handleOptionClick = async function(optionId, optionLabel) {
    document.querySelectorAll('.option-btn:not(:disabled)').forEach(btn => btn.disabled = true);
    addMessage(optionLabel, true);
    
    if (conversationState.step === 'identification') {
        conversationState.userData.identificationType = optionId;
        conversationState.step = 'awaiting_id_input';
        
        await delay(500);
        addMessage(`Por favor, digite o seu ${optionLabel.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').trim()}:`);
        
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
        saveSession();
    } 
    else if (conversationState.step === 'existing_complaint') {
            if (optionId === 'new') {
            addMessage("Por favor, selecione a categoria da sua reclamação:", false, categories.map(cat => ({
                id: cat.id,
                labelText: `${cat.labelText || cat.name} - ${cat.labelText ? '' : cat.desc}`.trim(),
                labelHtml: `${cat.labelHtml || cat.label} - <small>${cat.desc}</small>`,
                trustedHtml: true
            })));
            conversationState.step = 'category';
            saveSession();
        } else if (optionId === 'exit') {
            addMessage("Obrigado por utilizar o Alou CVT. Até breve! 👋");
            updateSessionStatus('Sessão encerrada', 'active');
            showRestartButton();
        } else if (optionId === 'view') {
            showTyping();
            await delay(1500);
            hideTyping();
            
            addMessage("A consultar os detalhes no sistema central...");
            await delay(1000);
            
            addMessage(`
                📊 <strong>Detalhes da Reclamação - RCL-2025-001234</strong><br><br>
                <strong>Fase Atual:</strong> Análise Técnica<br>
                <strong>Data de Registo:</strong> ${new Date(Date.now() - 172800000).toLocaleDateString('pt-PT')}<br>
                <strong>Última Atualização:</strong> Aguarda verificação da equipa de infraestrutura externa.<br>
                <strong>Prazo SLA:</strong> Faltam 2 dias úteis.
            `);
            
            await delay(1500);
                addMessage("Posso ajudar com mais alguma coisa?", false, [
                { id: 'new', labelText: '➕ Registar nova reclamação', labelHtml: '➕ Registar nova reclamação', trustedHtml: true },
                { id: 'human', labelText: '👤 Falar com assistente sobre isto', labelHtml: '👤 Falar com assistente sobre isto', trustedHtml: true },
                { id: 'exit', labelText: '❌ Encerrar', labelHtml: '❌ Encerrar', trustedHtml: true }
            ]);
            
            conversationState.step = 'after_view';
            saveSession();
        }
    } 
    else if (conversationState.step === 'after_view') {
            if (optionId === 'new') {
            addMessage("Por favor, selecione a categoria da sua reclamação:", false, categories.map(cat => ({
                id: cat.id,
                labelText: `${cat.labelText || cat.name} - ${cat.labelText ? '' : cat.desc}`.trim(),
                labelHtml: `${cat.labelHtml || cat.label} - <small>${cat.desc}</small>`,
                trustedHtml: true
            })));
            conversationState.step = 'category';
            saveSession();
        } else if (optionId === 'human') {
            showTyping();
            await delay(2000);
            hideTyping();
            addMessage("Vou transferi-lo para um assistente humano para analisar o estado deste processo em detalhe.");
            updateSessionStatus('Transferido para assistente', 'active');
            // record transfer metric and mark session timer
            recordTransferToHuman();
            endSessionTimer(false);
            await delay(1000);
            addMessage("🧑‍💼 <strong>Assistente Maria:</strong> Olá! Já tenho o seu processo aberto. Um momento por favor enquanto verifico os detalhes técnicos...");
            showRestartButton();
        } else if (optionId === 'exit') {
            addMessage("Obrigado por utilizar o Alou CVT. Até breve! 👋");
            updateSessionStatus('Sessão encerrada', 'active');
            showRestartButton();
        }
    }
    else if (conversationState.step === 'category') {
        conversationState.category = optionId;
        const selectedCat = categories.find(c => c.id === optionId);
        updateSessionStatus(`Categoria: ${selectedCat.name}`);
        
        addMessage("Por favor, descreva detalhadamente o motivo da sua reclamação:");
        conversationState.step = 'description';
        
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
        saveSession();
    } 
    else if (conversationState.step === 'critical_decision') {
        if (optionId === 'human') {
            showTyping();
            await delay(2000);
            hideTyping();
            addMessage("Esta situação requer atenção imediata. Vou transferi-lo para um assistente humano.");
            updateSessionStatus('Transferido para assistente', 'active');
            recordTransferToHuman();
            endSessionTimer(false);
            await delay(1000);
            addMessage("🧑‍💼 <strong>Assistente Maria:</strong> Olá! Vou ajudá-lo pessoalmente com a sua situação. Um momento por favor...");
            showRestartButton();
        } else {
            await processNonCriticalComplaint();
        }
    } 
    else if (conversationState.step === 'retry_submission') {
        if (optionId === 'retry') {
            // user requested retry of ticket creation
            showTyping();
            await delay(500);
            hideTyping();
            await processNonCriticalComplaint();
        }
    }
    else if (conversationState.step === 'satisfaction') {
        // record satisfaction metric
        recordSatisfaction(optionId);
        addMessage("Obrigado pelo seu feedback! A sua opinião ajuda-nos a melhorar.");
        updateSessionStatus('Sessão concluída', 'active');
        endSessionTimer(false);
        showRestartButton();
    }
};

async function handleUserMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    
    addMessage(text, true);
    userInput.value = '';
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    if (conversationState.step === 'awaiting_id_input') {
        const idType = conversationState.userData.identificationType;
        if (!validateIdentification(idType, text)) {
            const errorMsg = conversationState.lastValidationError || "❌ O formato introduzido parece incorreto para o tipo selecionado. Por favor, tente novamente.";
            addMessage(`❌ ${errorMsg}`);
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
            return;
        }

        showTyping();
        try {
            const userData = await mockAPI.authenticate(conversationState.userData.identificationType, text);
            hideTyping();
            
            addMessage("Excelente! Verificando os seus dados...");
            updateSessionStatus(`Cliente validado (${text})`);
            
            await delay(1000);
            showTyping();
            await delay(1500);
            hideTyping();
            
            addMessage("A verificar o histórico no sistema...");
            await delay(1000);
            
            if (userData.hasExisting) {
                addMessage("Encontrei uma reclamação já registada no seu nome:");
                addMessage(`
                    <strong>Identificação:</strong> RCL-2025-001234<br>
                    <strong>Categoria:</strong> Qualidade de Sinal<br>
                    <strong>Estado:</strong> Em Análise<br>
                    <strong>Prazo:</strong> 2 dias úteis restantes
                `);
                
                await delay(1000);
                addMessage("Como deseja proceder?", false, [
                    { id: 'view', labelText: '👁️ Ver estado detalhado', labelHtml: '👁️ Ver estado detalhado', trustedHtml: true },
                    { id: 'new', labelText: '➕ Registar nova reclamação', labelHtml: '➕ Registar nova reclamaação', trustedHtml: true },
                    { id: 'exit', labelText: '❌ Sair', labelHtml: '❌ Sair', trustedHtml: true }
                ]);
                conversationState.step = 'existing_complaint';
            } else {
                addMessage("Não encontrei reclamações em aberto. Vamos registar uma nova.");
                await delay(1000);
                addMessage("Por favor, selecione a categoria da sua reclamação:", false, categories.map(cat => ({
                    id: cat.id,
                    labelText: `${cat.labelText || cat.name} - ${cat.labelText ? '' : cat.desc}`.trim(),
                    labelHtml: `${cat.labelHtml || cat.label} - <small>${cat.desc}</small>`,
                    trustedHtml: true
                })));
                conversationState.step = 'category';
            }
            saveSession();
            
        } catch (error) {
            hideTyping();
            updateSessionStatus('Erro de Autenticação', 'error');
            addMessage(`⚠️ <strong>Erro de Sistema:</strong> ${error.message}`);
            addMessage("Por favor, tente inserir os dados novamente:");
            
            userInput.disabled = false;
            sendBtn.disabled = false;
            userInput.focus();
        }
    } 
    else if (conversationState.step === 'description') {
        conversationState.userData.description = text;
        
        showTyping();
        await delay(1500);
        hideTyping();
        
        addMessage("Analisando os detalhes fornecidos...");
        await delay(1000);
        
        conversationState.critical = analyzeCriticality(text);
        
        if (conversationState.critical) {
            addMessage("⚠️ <strong>Atenção:</strong> Detectei que esta situação envolve termos críticos e pode requerer prioridade legal ou técnica máxima.");
            await delay(1000);
                addMessage("Como deseja proceder?", false, [
                    { id: 'human', labelText: '👤 Transferir para assistente humano agora', labelHtml: '👤 Transferir para assistente humano agora', trustedHtml: true },
                    { id: 'continue', labelText: '✅ Manter registo automático normal', labelHtml: '✅ Manter registo automático normal', trustedHtml: true }
                ]);
            conversationState.step = 'critical_decision';
            saveSession();
        } else {
            await processNonCriticalComplaint();
        }
    }
}

async function processNonCriticalComplaint() {
    showTyping();
    await delay(1000);
    updateSessionStatus('A comunicar com o CRM...');
    
    try {
        const protocol = await mockAPI.createTicket(conversationState);
        hideTyping();
        
        conversationState.protocol = protocol;
        // mark resolved by bot and record metrics
        endSessionTimer(true);

        addMessage("Reclamação registada com sucesso! Aqui está o seu recibo:");
        addMessage(`
            <div class="protocol-card">
                <div>📋 RECIBO DE RECLAMAÇÃO</div>
                <div class="protocol-number">${protocol}</div>
                <div style="font-size: 13px; opacity: 0.9; margin-top: 10px;">
                        Categoria: ${categories.find(c => c.id === conversationState.category).name}<br>
                    Data: ${new Date().toLocaleDateString('pt-PT')}<br>
                    Prazo de resolução: 5 dias úteis
                </div>
            </div>
        `);
        
        updateSessionStatus('Reclamação registada com sucesso', 'active');
        
        await delay(1500);
        addMessage("📧 Enviámos uma confirmação para o seu email com os detalhes e prazos (SLA).");
        
        await delay(1500);
                addMessage("Como avalia a sua experiência com o Alou hoje?", false, [
                    { id: 'great', labelText: '😄 Excelente', labelHtml: '😄 Excelente', trustedHtml: true },
                    { id: 'good', labelText: '🙂 Bom', labelHtml: '🙂 Bom', trustedHtml: true },
                    { id: 'ok', labelText: '😐 Razoável', labelHtml: '😐 Razoável', trustedHtml: true },
                    { id: 'bad', labelText: '😞 Insatisfeito', labelHtml: '😞 Insatisfeito', trustedHtml: true }
                ]);
        conversationState.step = 'satisfaction';
        saveSession();

    } catch (error) {
        hideTyping();
        updateSessionStatus('Erro no Registo', 'error');
        addMessage(`⚠️ <strong>Erro:</strong> ${error.message}`);
        addMessage("Os nossos sistemas estão temporariamente indisponíveis. A sua sessão foi guardada. Deseja tentar submeter novamente?", false, [
            { id: 'retry', labelText: '🔄 Tentar Novamente', labelHtml: '🔄 Tentar Novamente', trustedHtml: true }
        ]);
        conversationState.step = 'retry_submission';
        // keep main handler and use a dedicated branch for retry (avoids overwriting global handler)
        saveSession();
    }
}

function showRestartButton() {
    const restartDiv = document.createElement('div');
    restartDiv.className = 'message bot';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    const btn = document.createElement('button');
    btn.className = 'restart-btn';
    btn.textContent = '🔄 Iniciar Nova Reclamação';
    btn.addEventListener('click', () => clearSession());
    bubble.appendChild(btn);
    restartDiv.appendChild(bubble);
    chatMessages.appendChild(restartDiv);
    scrollToBottom();
    saveSession();
}

// --- INITIALIZATION ---
function initChatbot() {
    let savedSession = null;
    
    try {
        savedSession = sessionStorage.getItem(SESSION_KEY);
    } catch (error) {}
    
    if (savedSession) {
        try {
            const data = JSON.parse(savedSession);
            conversationState = data.state || conversationState;
            messages = data.messages || [];
            sessionStatus.textContent = data.statusText || sessionStatus.textContent;
            statusBadge.className = data.badgeClass || statusBadge.className;
            statusBadge.textContent = data.badgeText || statusBadge.textContent;
            initMetrics();

            // render saved messages safely
            chatMessages.innerHTML = '';
            messages.forEach(m => {
                const msgDiv = document.createElement('div');
                msgDiv.className = `message ${m.sender === 'user' ? 'user' : 'bot'}`;
                const bubble = document.createElement('div');
                bubble.className = 'message-bubble';
                bubble.setAttribute('role','article');
                bubble.setAttribute('aria-label', m.sender === 'user' ? 'Mensagem do utilizador' : 'Mensagem do assistente');
                if (m.sender === 'user') bubble.textContent = m.text;
                else bubble.innerHTML = m.text;
                if (m.options) {
                    const opts = document.createElement('div');
                    opts.className = 'options';
                    opts.setAttribute('role','list');
                    m.options.forEach((o, idx) => {
                        const b = document.createElement('button');
                        b.className = 'option-btn';
                        b.setAttribute('role','option');
                        if (o.labelText) b.textContent = o.labelText;
                        else if (o.label) b.textContent = o.label;
                        if (o.trustedHtml && o.labelHtml) b.innerHTML = o.labelHtml;
                        b.setAttribute('aria-label', `Opção: ${o.labelText || o.label || o.id}`);
                        b.addEventListener('click', () => { if (window.handleOptionClick) window.handleOptionClick(o.id, o.labelText || o.label || o.id); });
                        b.addEventListener('keydown', (e) => {
                            const focusable = Array.from(opts.querySelectorAll('.option-btn'));
                            const i = focusable.indexOf(e.currentTarget);
                            if (e.key === 'ArrowDown') { e.preventDefault(); focusable[(i+1)%focusable.length].focus(); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); focusable[(i-1+focusable.length)%focusable.length].focus(); }
                            else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); }
                        });
                        // make all saved options keyboard-focusable
                        b.tabIndex = 0;
                        opts.appendChild(b);
                    });
                    bubble.appendChild(opts);
                    setTimeout(() => { const first = opts.querySelector('.option-btn:not(:disabled)'); if (first) first.focus(); }, 50);
                }
                msgDiv.appendChild(bubble);
                chatMessages.appendChild(msgDiv);
            });

            addMessage("🔄 <em>Sessão recuperada. Pode continuar de onde parou.</em>");

            if (['awaiting_id_input', 'description'].includes(conversationState.step)) {
                userInput.disabled = false;
                sendBtn.disabled = false;
            }
            scrollToBottom();
            return;
        } catch (parseError) {
            clearSession();
        }
    } 
    
    chatMessages.innerHTML = `
        <div class="message bot">
            <div class="message-bubble">
                Olá! Sou o Alou, o assistente virtual da CVTelecom. 👋<br><br>
                Estou aqui para ajudá-lo a registar a sua reclamação de forma rápida e conveniente, 24/7.
            </div>
        </div>
    `;
    
    setTimeout(() => {
        // initialize metrics for a new session
        initMetrics();
        conversationState.metrics.sessionsStarted = (conversationState.metrics.sessionsStarted || 0) + 1;
        startSessionTimer();

        addMessage("Para começar, preciso validar a sua identidade. Como deseja identificar-se?", false, [
            { id: 'nif', labelText: '🔢 NIF', labelHtml: '🔢 NIF', trustedHtml: true },
            { id: 'conta', labelText: '📱 Número de Cliente', labelHtml: '📱 Número de Cliente', trustedHtml: true },
            { id: 'telemovel', labelText: '📞 Número de Telemóvel', labelHtml: '📞 Número de Telemóvel', trustedHtml: true }
        ]);
        conversationState.step = 'identification';
        saveSession();
    }, 1000);
}

// Event listeners
sendBtn.addEventListener('click', handleUserMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleUserMessage();
    }
});

// Keyboard accessibility: Allow Escape to focus chat input
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.activeElement !== userInput) {
        userInput.focus();
    }
});

// Enhanced keyboard navigation for options
document.addEventListener('keydown', (e) => {
    const focusedOption = document.querySelector('.option-btn:focus');
    if (focusedOption && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        focusedOption.click();
    }
});

// Start
initChatbot();
