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

function saveSession() {
    try {
        const sessionData = {
            state: conversationState,
            html: document.getElementById('chatMessages').innerHTML,
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
                    reject(new Error("Falha ao gravar protocolo no sistema central."));
                } else {
                    resolve(`RCL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900000) + 100000)}`);
                }
            }, 2000);
        });
    }
};

// 3. NLP / KEYWORD ANALYSIS
const analyzeCriticality = (text) => {
    const criticalKeywords = ['anacom', 'advogado', 'cancelar', 'tribunal', 'urgente', 'polícia', 'processo'];
    return criticalKeywords.some(keyword => text.toLowerCase().includes(keyword));
};

// UI Elements
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const sessionStatus = document.getElementById('sessionStatus');
const statusBadge = document.getElementById('statusBadge');

// Categories Configuration
const categories = [
    { id: 'faturacao', label: '💳 Faturação', desc: 'Problemas com faturas ou cobranças' },
    { id: 'sinal', label: '📶 Qualidade de Sinal', desc: 'Internet lenta ou sem conexão' },
    { id: 'tecnico', label: '🔧 Apoio Técnico', desc: 'Problemas com equipamentos' },
    { id: 'atendimento', label: '👤 Atendimento', desc: 'Questões de serviço ao cliente' },
    { id: 'outro', label: '📋 Outro', desc: 'Outras situações' }
];

// Utility Functions
function scrollToBottom() { chatMessages.scrollTop = chatMessages.scrollHeight; }
async function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

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
    if (!score) return;
    const m = conversationState.metrics;
    if (!m) return;
    m.npsScores.push(score);
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
    bubbleDiv.innerHTML = text;
    
    if (options) {
        const optionsDiv = document.createElement('div');
        optionsDiv.className = 'options';
        options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            btn.innerHTML = option.label;
            btn.addEventListener('click', (e) => {
                // disable other buttons in this option group to prevent double clicks
                optionsDiv.querySelectorAll('.option-btn:not(:disabled)').forEach(b => b.disabled = true);
                if (window.handleOptionClick) window.handleOptionClick(option.id, option.label);
            });
            optionsDiv.appendChild(btn);
        });
        bubbleDiv.appendChild(optionsDiv);
    }
    
    messageDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
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
                label: `${cat.label} - <small>${cat.desc}</small>`
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
                📊 <strong>Detalhes do Protocolo RCL-2025-001234</strong><br><br>
                <strong>Fase Atual:</strong> Análise Técnica<br>
                <strong>Data de Registo:</strong> ${new Date(Date.now() - 172800000).toLocaleDateString('pt-PT')}<br>
                <strong>Última Atualização:</strong> Aguarda verificação da equipa de infraestrutura externa.<br>
                <strong>Prazo SLA:</strong> Faltam 2 dias úteis.
            `);
            
            await delay(1500);
            addMessage("Posso ajudar com mais alguma coisa?", false, [
                { id: 'new', label: '➕ Registar nova reclamação' },
                { id: 'human', label: '👤 Falar com assistente sobre isto' },
                { id: 'exit', label: '❌ Encerrar' }
            ]);
            
            conversationState.step = 'after_view';
            saveSession();
        }
    } 
    else if (conversationState.step === 'after_view') {
        if (optionId === 'new') {
            addMessage("Por favor, selecione a categoria da sua reclamação:", false, categories.map(cat => ({
                id: cat.id,
                label: `${cat.label} - <small>${cat.desc}</small>`
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
        updateSessionStatus(`Categoria: ${selectedCat.label.split(' ')[1]}`);
        
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
        if (text.length < 7) {
            addMessage("❌ O formato introduzido parece incorreto. Por favor, tente novamente.");
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
                    <strong>Protocolo:</strong> RCL-2025-001234<br>
                    <strong>Categoria:</strong> Qualidade de Sinal<br>
                    <strong>Estado:</strong> Em Análise<br>
                    <strong>Prazo:</strong> 2 dias úteis restantes
                `);
                
                await delay(1000);
                addMessage("Como deseja proceder?", false, [
                    { id: 'view', label: '👁️ Ver estado detalhado' },
                    { id: 'new', label: '➕ Registar nova reclamação' },
                    { id: 'exit', label: '❌ Sair' }
                ]);
                conversationState.step = 'existing_complaint';
            } else {
                addMessage("Não encontrei reclamações em aberto. Vamos registar uma nova.");
                await delay(1000);
                addMessage("Por favor, selecione a categoria da sua reclamação:", false, categories.map(cat => ({
                    id: cat.id,
                    label: `${cat.label} - <small>${cat.desc}</small>`
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
                { id: 'human', label: '👤 Transferir para assistente humano agora' },
                { id: 'continue', label: '✅ Manter registo automático normal' }
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

        addMessage("Reclamação registada com sucesso! Aqui está o seu protocolo:");
        addMessage(`
            <div class="protocol-card">
                <div>📋 PROTOCOLO DE RECLAMAÇÃO</div>
                <div class="protocol-number">${protocol}</div>
                <div style="font-size: 13px; opacity: 0.9; margin-top: 10px;">
                    Categoria: ${categories.find(c => c.id === conversationState.category).label.split(' ')[1]}<br>
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
            { id: 'great', label: '😄 Excelente' },
            { id: 'good', label: '🙂 Bom' },
            { id: 'ok', label: '😐 Razoável' },
            { id: 'bad', label: '😞 Insatisfeito' }
        ]);
        conversationState.step = 'satisfaction';
        saveSession();

    } catch (error) {
        hideTyping();
        updateSessionStatus('Erro no Registo', 'error');
        addMessage(`⚠️ <strong>Erro:</strong> ${error.message}`);
        addMessage("Os nossos sistemas estão temporariamente indisponíveis. A sua sessão foi guardada. Deseja tentar submeter novamente?", false, [
            { id: 'retry', label: '🔄 Tentar Novamente' }
        ]);
        conversationState.step = 'retry_submission';
        // keep main handler and use a dedicated branch for retry (avoids overwriting global handler)
        saveSession();
    }
}

function showRestartButton() {
    const restartDiv = document.createElement('div');
    restartDiv.className = 'message bot';
    restartDiv.innerHTML = `
        <div class="message-bubble">
            <button class="restart-btn" onclick="clearSession()">
                🔄 Iniciar Nova Reclamação
            </button>
        </div>
    `;
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
            conversationState = data.state;
            chatMessages.innerHTML = data.html;
            sessionStatus.textContent = data.statusText;
            statusBadge.className = data.badgeClass;
            statusBadge.textContent = data.badgeText;
            initMetrics();
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
            { id: 'nif', label: '🔢 NIF' },
            { id: 'conta', label: '📱 Número da Conta' },
            { id: 'telemovel', label: '📞 Número de Telemóvel' }
        ]);
        conversationState.step = 'identification';
        saveSession();
    }, 1000);
}

// Event listeners
sendBtn.addEventListener('click', handleUserMessage);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserMessage();
});

// Start
initChatbot();
