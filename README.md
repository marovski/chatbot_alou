# Alou CVT - Assistente Virtual de Reclamações

Um chatbot interativo para gestão e registo de reclamações de clientes da CVTelecom, construído com HTML5, CSS3 e JavaScript vanilla.

## 📋 Características

- **Identificação de Cliente**: Validação via NIF, número de conta ou telemóvel
- **Consulta de Reclamações Existentes**: Verificação do histórico de reclamações ativas
- **Registo de Novas Reclamações**: Categorização e descrição detalhada
- **Análise de Criticidade**: Detecção automática de situações críticas (ARME, tribunal, advogado, etc.)
- **Transferência para Assistente**: Encaminhamento automático para equipa humana em casos críticos
- **KPIs Dinâmicos**: Rastreamento em tempo real de:
  - Taxa de Contenção (resoluções automáticas vs. transferências)
  - TMR Médio (Tempo Médio de Resolução)
  - NPS (Net Promoter Score)
  - Disponibilidade do sistema
- **Persistência de Sessão**: Recuperação automática de sessões interrompidas via `sessionStorage`
- **Design Responsivo**: Adaptado para desktop e mobile
- **Interface Moderna**: Gradientes, animações e feedback visual

## 🛠 Tecnologia

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Armazenamento**: `sessionStorage` (sem backend necessário)
- **Arquitetura**: MVC com separação de responsabilidades
- **Build**: Nenhuma dependência (vanilla JS)

## 📂 Estrutura do Projeto

```
chatbot_alou/
├── index.html           # Markup HTML
├── styles.css           # Estilos CSS
├── app.js               # Lógica JavaScript
├── chatbotAlouLogo.png  # Logo do assistente
├── CVTELECOM.png        # Logo da empresa (posicionado no rodapé)
└── README.md            # Este ficheiro
```

## 🚀 Como Usar

### Requisitos
- Navegador moderno (Chrome, Firefox, Safari, Edge)
- Sem dependências externas

### Instalação e Execução

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/seu-usuario/chatbot_alou.git
   cd chatbot_alou
   ```

2. **Abra o ficheiro `index.html` num navegador:**
   ```bash
   # No Windows
   start index.html
   
   # No macOS
   open index.html
   
   # No Linux
   xdg-open index.html
   ```

3. **Ou use um servidor local (Python 3):**
   ```bash
   cd ChatbotAlou/chatbot_alou
   python -m http.server 8000
   ```
   Depois abra `http://localhost:8000/index.html` no navegador.

## 💬 Fluxo de Conversa

### 1. Identificação
O utilizador escolhe como deseja identificar-se:
- 🔢 NIF
- 📱 Número da Conta
- 📞 Número de Telemóvel

### 2. Validação
Simulação de autenticação via API (atualmente com mock)

### 3. Verificação de Histórico
Se existem reclamações ativas, o utilizador pode:
- 👁️ Ver estado detalhado
- ➕ Registar nova reclamação
- ❌ Sair

### 4. Registo de Reclamação
Seleção da categoria:
- 💳 Faturação
- 📶 Qualidade de Sinal
- 🔧 Apoio Técnico
- 👤 Atendimento
- 📋 Outro

### 5. Descrição Detalhada
O utilizador descreve o motivo da reclamação

### 6. Análise de Criticidade
Se forem detetadas palavras-chave críticas (ARME, tribunal, advogado, etc.):
- ⚠️ Alertar o utilizador
- 👤 Oferecer transferência para assistente humano

### 7. Registo ou Transferência
- Reclamação registada com número de protocolo
- OU Transferência para assistente Maria

### 8. Feedback
Avaliação de satisfação do utilizador (NPS)

## 📊 KPIs do Sistema

Os KPIs são calculados dinamicamente com base nas interações:

### Taxa de Contenção
```
(Reclamações resolvidas pelo bot) / (Reclamações totais) × 100%
```

### TMR (Tempo Médio de Resolução)
```
Tempo total de todas as sessões / Número de sessões resolvidas
```

### NPS (Net Promoter Score)
```
((Promotores - Detratores) / Total de respondentes) × 100
```
- Promotores: Avaliação 9-10 (😄 Excelente / 🙂 Bom)
- Detratores: Avaliação ≤6 (😐 Razoável / 😞 Insatisfeito)

## 🔒 Persistência de Dados

As sessões são automaticamente guardadas em `sessionStorage`:
- Estado da conversa
- Histórico de mensagens
- KPIs acumulados
- Status da sessão

Ao recarregar a página, a sessão é recuperada automaticamente.

## 🎨 Cores e Branding

- **Primária**: #00A9A5 (Teal)
- **Secundária**: #E8322A (Vermelho CVT)
- **Fundo**: Gradiente azul (#1A2D5A → #2C4A7C)
- **Texto**: #1A2D5A (Azul escuro)

## 🤖 Mock API

Atualmente o projeto utiliza APIs simuladas com delays realistas:
- `mockAPI.authenticate()`: 1500ms (simula consulta ao CRM)
- `mockAPI.createTicket()`: 2000ms (simula gravação no sistema central)

## 📱 Responsividade

O design adapta-se automaticamente:
- **Desktop**: Layout em 2 colunas (chat + painéis)
- **Mobile**: Layout em coluna única (painéis acima do chat)
- Breakpoint: 768px

## 🔧 Desenvolvimento

### Adicionar uma Nova Categoria de Reclamação

Edite `app.js` e adicione à array `categories`:

```javascript
const categories = [
    { id: 'minha_categoria', label: '✨ Minha Categoria', desc: 'Descrição da categoria' },
    // ...
];
```

### Modificar o Fluxo de Conversa

Edite a função `window.handleOptionClick` em `app.js` para adicionar novos estados e lógica.

### Customizar Estilos

Edite `styles.css` para alterar cores, fonts, espaçamento, etc.

## 🚨 Tratamento de Erros

O chatbot inclui:
- ✅ Validação de formato de identificação (mín. 7 caracteres)
- ⚠️ Retry automático para erros de API
- 🔄 Recuperação de sessão em caso de falha
- 📢 Mensagens de erro amigáveis ao utilizador

## 📝 Logs e Debugging

Abra a consola do navegador (F12) para:
- Ver logs de estado da conversa
- Monitorizar chamadas de API
- Verificar métricas de KPI
- Diagnosticar problemas de sessão

## 🔐 Segurança

- ❌ Sem dados pessoais armazenados permanentemente
- ✅ Apenas `sessionStorage` (limpo ao fechar navegador)
- ✅ Input sanitizado via `textContent`
- ✅ CSRF não aplicável (sem backend real)

## 📄 Licença

Este projeto é propriedade da CVTelecom. Todos os direitos reservados.

## 👥 Contacto e Suporte

Para questões ou sugestões, contacte:
- **Email**: mario.cardoso@cvt.cv

---

**Versão**: 1.0  
**Última atualização**: Fevereiro 2026  
**Desenvolvedor**: MÁRIO CARDOSO
**Grupo de Trabalho**: Cleidir, Denise, Gisela e Mário
