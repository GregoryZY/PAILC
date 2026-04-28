// vareaveis globais
let mapa = null;
let marcador = null;
let usuarioAtual = null;
let analiseAtual = null;

// URL do backend 
const API_URL = 'http://localhost:5000/api';

// mascara Cep  
document.getElementById('cep-input').addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 5) {
        value = value.slice(0, 5) + '-' + value.slice(5, 8);
    }
    e.target.value = value;
});

//  funções cadastrar login

async function cadastrarUsuario() {
    const nome = document.getElementById('nome').value;
    const email = document.getElementById('email').value;
    const telefone = document.getElementById('telefone').value;
    const senha = document.getElementById('senha').value;
    const msgDiv = document.getElementById('msg-cadastro');

    if (!nome || !email || !telefone || !senha) {
        msgDiv.innerHTML = '<span class="error">Preencha todos os campos</span>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/cadastrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, telefone, senha })
        });
        const data = await response.json();

        if (response.ok) {
            msgDiv.innerHTML = '<span class="success">Cadastro realizado! Faça login.</span>';
            document.getElementById('nome').value = '';
            document.getElementById('email').value = '';
            document.getElementById('telefone').value = '';
            document.getElementById('senha').value = '';
        } else {
            msgDiv.innerHTML = `<span class="error">${data.erro || 'Erro no cadastro'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span class="error">Erro de conexão com o servidor</span>';
    }
}

async function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-senha').value;
    const msgDiv = document.getElementById('msg-login');

    if (!email || !senha) {
        msgDiv.innerHTML = '<span class="error">Preencha email e senha</span>';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });
        const data = await response.json();

        if (response.ok) {
            usuarioAtual = data.usuario;
            localStorage.setItem('usuario', JSON.stringify(usuarioAtual));
            msgDiv.innerHTML = '<span class="success">Login realizado!</span>';
            
            document.getElementById('login-email').value = '';
            document.getElementById('login-senha').value = '';
            document.getElementById('negocio-section').style.display = 'block';
            
            carregarPerfil();
            carregarHistorico();
        } else {
            msgDiv.innerHTML = `<span class="error">${data.erro || 'Email ou senha inválidos'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span class="error">Erro de conexão com o servidor</span>';
    }
}

function logout() {
    usuarioAtual = null;
    localStorage.removeItem('usuario');
    document.getElementById('negocio-section').style.display = 'none';
    mostrarDashboard();
    location.reload();
}

async function salvarPreferencia() {
    if (!usuarioAtual) {
        document.getElementById('msg-preferencia').innerHTML = '<span class="error">Faça login primeiro</span>';
        return;
    }

    const tipoNegocio = document.getElementById('tipo-negocio').value;
    const msgDiv = document.getElementById('msg-preferencia');

    try {
        const response = await fetch(`${API_URL}/preferencia`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                id_usuario: usuarioAtual.id, 
                tipo_negocio: tipoNegocio 
            })
        });
        const data = await response.json();

        if (response.ok) {
            msgDiv.innerHTML = '<span class="success">Preferência salva!</span>';
            usuarioAtual.tipo_negocio = tipoNegocio;
            localStorage.setItem('usuario', JSON.stringify(usuarioAtual));
        } else {
            msgDiv.innerHTML = `<span class="error">${data.erro || 'Erro ao salvar'}</span>`;
        }
    } catch (error) {
        msgDiv.innerHTML = '<span class="error">Erro de conexão</span>';
    }
}

// funções de busca e analise

async function buscarEndereco() {
    let cep = document.getElementById('cep').value.replace(/\D/g, '');
    
    if (cep.length !== 8) {
        alert('Digite um CEP válido com 8 números');
        return;
    }

    document.getElementById('loader').style.display = 'flex';
    document.getElementById('resultados').style.display = 'none';

    try {
        const response = await fetch(`${API_URL}/analisar-local`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                cep: cep,
                tipo_negocio: usuarioAtual.tipo_negocio || 'Restaurante'
            })
        });
        
        const dados = await response.json();

        if (response.ok) {
            exibirResultados(dados);
            analiseAtual = dados;
            document.getElementById('btn-salvar-analise').style.display = usuarioAtual ? 'block' : 'none';
        } else {
            alert(dados.erro || 'Erro ao analisar local');
        }
    } catch (error) {
        alert('Erro de conexão com o servidor');
    } finally {
        document.getElementById('loader').style.display = 'none';
    }
}

function exibirResultados(dados) {
    document.getElementById('resultados').style.display = 'block';
    
    // Coordenadas
    document.getElementById('coordenadas').innerHTML = 
        `Coordenadas: Latitude ${dados.lat.toFixed(6)} | Longitude ${dados.lng.toFixed(6)}`;
    
    // Score
    const scoreEl = document.getElementById('score-value');
    scoreEl.innerHTML = `${dados.score}/100`;
    scoreEl.className = `score-value score-${dados.cor_score}`;
    document.getElementById('recomendacao').innerHTML = dados.recomendacao;
    
    const progressFill = document.getElementById('progress-fill');
    progressFill.style.width = `${dados.score}%`;
    progressFill.className = `progress-fill ${dados.cor_score}`;
    
    // Mapa
    if (mapa) mapa.remove();
    
    mapa = L.map('mapa').setView([dados.lat, dados.lng], 15);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
    }).addTo(mapa);
    
    marcador = L.marker([dados.lat, dados.lng])
        .addTo(mapa)
        .bindPopup('<b>Local pesquisado</b>')
        .openPopup();
    
    // Tabela de negócios relevantes
    if (dados.negocios_relevantes && dados.negocios_relevantes.length > 0) {
        let html = '<table><th>Nome</th><th>Tipo</th><th>Distância</th></tr>';
        dados.negocios_relevantes.forEach(n => {
            html += `<tr><td>${n.nome}</td><td>${n.tipo}</td><td>${n.distancia}m</td></tr>`;
        });
        html += '</table>';
        document.getElementById('negocios-relevantes').innerHTML = html;
    } else {
        document.getElementById('negocios-relevantes').innerHTML = '<p style="color:#999">Nenhum comércio relevante encontrado</p>';
    }
    
    // Tabela de negócios gerais
    if (dados.negocios_gerais && dados.negocios_gerais.length > 0) {
        let html = '<tr><th>Nome</th><th>Tipo</th><th>Distância</th></tr>';
        dados.negocios_gerais.forEach(n => {
            html += `<tr><td>${n.nome}</td><td>${n.tipo}</td><td>${n.distancia}m</td></tr>`;
        });
        html += '</table>';
        document.getElementById('negocios-gerais').innerHTML = html;
    } else {
        document.getElementById('negocios-gerais').innerHTML = '<p style="color:#999">Nenhum estabelecimento encontrado</p>';
    }
}

async function salvarAnalise() {
    if (!usuarioAtual || !analiseAtual) return;

    try {
        const response = await fetch(`${API_URL}/salvar-analise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: usuarioAtual.id,
                cep: analiseAtual.cep,
                logradouro: analiseAtual.logradouro,
                bairro: analiseAtual.bairro,
                cidade: analiseAtual.cidade,
                estado: analiseAtual.estado,
                lat: analiseAtual.lat,
                lng: analiseAtual.lng,
                score: analiseAtual.score,
                recomendacao: analiseAtual.recomendacao,
                negocios: [...(analiseAtual.negocios_relevantes || []), ...(analiseAtual.negocios_gerais || [])]
            })
        });
        
        if (response.ok) {
            alert('Análise salva no histórico!');
            carregarHistorico();
        } else {
            alert('Erro ao salvar análise');
        }
    } catch (error) {
        alert('Erro de conexão');
    }
}

// funções de navegação

async function carregarHistorico() {
    if (!usuarioAtual) return;

    try {
        const response = await fetch(`${API_URL}/historico/${usuarioAtual.id}`);
        const dados = await response.json();
        
        const container = document.getElementById('lista-historico');
        
        if (dados.historico && dados.historico.length > 0) {
            container.innerHTML = '';
            dados.historico.forEach(item => {
                container.innerHTML += `
                    <div class="historico-item">
                        <div class="historico-info">
                            <h4>${item.logradouro}, ${item.bairro} - ${item.cidade}</h4>
                            <p>CEP: ${item.cep} | Data: ${new Date(item.data).toLocaleDateString()}</p>
                        </div>
                        <div class="historico-score ${item.cor_score}">${item.score}/100</div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p class="placeholder">Nenhuma análise salva ainda</p>';
        }
    } catch (error) {
        document.getElementById('lista-historico').innerHTML = '<p class="placeholder">Erro ao carregar histórico</p>';
    }
}

function carregarPerfil() {
    if (usuarioAtual) {
        document.getElementById('perfil-nome').innerText = usuarioAtual.nome || '-';
        document.getElementById('perfil-email').innerText = usuarioAtual.email || '-';
        document.getElementById('perfil-telefone').innerText = usuarioAtual.telefone || '-';
        document.getElementById('perfil-negocio').innerText = usuarioAtual.tipo_negocio || 'Não definido';
    }
}

function mostrarDashboard() {
    document.getElementById('dashboard-page').style.display = 'block';
    document.getElementById('historico-page').style.display = 'none';
    document.getElementById('perfil-page').style.display = 'none';
    
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.menu-item')[0].classList.add('active');
}

function mostrarHistorico() {
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('historico-page').style.display = 'block';
    document.getElementById('perfil-page').style.display = 'none';
    
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.menu-item')[1].classList.add('active');
    
    if (usuarioAtual) carregarHistorico();
}

function mostrarPerfil() {
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('historico-page').style.display = 'none';
    document.getElementById('perfil-page').style.display = 'block';
    
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.menu-item')[2].classList.add('active');
    
    carregarPerfil();
}

//  inicialização
document.addEventListener('DOMContentLoaded', () => {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (usuarioSalvo) {
        usuarioAtual = JSON.parse(usuarioSalvo);
        document.getElementById('negocio-section').style.display = 'block';
        carregarPerfil();
    }
});
