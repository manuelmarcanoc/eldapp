import React, { useState } from 'react';
import './App.css';
import Asistente from './Asistente'; 

// --- TU CLAVE API ---
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
console.log("KEY:", GEMINI_API_KEY);
console.log("LEN:", (GEMINI_API_KEY || "").length);

// --------------------

function App() {
  const [busqueda, setBusqueda] = useState('');
  const [contenido, setContenido] = useState('');
  const [tamanoLetra, setTamanoLetra] = useState(28); 
  const [altoContraste, setAltoContraste] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [modeloDetectado, setModeloDetectado] = useState(null); // Aquí guardaremos el nombre real
  
  const [modoVista, setModoVista] = useState('inicio'); 
  const [listaItems, setListaItems] = useState([]);
  const [tituloSeccion, setTituloSeccion] = useState('');

  const menuOpciones = {
    prensa: [
      { nombre: "El País", rss: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada" },
      { nombre: "El Mundo", rss: "https://e00-elmundo.uecdn.es/rss/portada.xml" },
      { nombre: "ABC", rss: "https://www.abc.es/rss/2.0/portada/" }
    ],
    deportes: [
      { nombre: "Marca", rss: "https://e00-marca.uecdn.es/rss/portada.xml" },
      { nombre: "Diario AS", rss: "https://as.com/rss/tags/ultimas_noticias.xml" }
    ],
    cantabria: [
      { nombre: "El Diario Cantabria", rss: "https://eldiariocantabria.publico.es/rss" },
      { nombre: "Esquelas Cantabria", tipo: "esquelas_parser" }
    ]
  };

  const leerRespuesta = (texto) => {
    window.speechSynthesis.cancel(); 
    const voz = new SpeechSynthesisUtterance(texto);
    voz.lang = 'es-ES';
    voz.rate = 0.9; 
    window.speechSynthesis.speak(voz);
  };

  // --- PASO 1: DETECTAR QUÉ MODELO TIENES ACTIVADO ---
  const encontrarModelo = async () => {
      try {
          console.log("Buscando modelos disponibles...");
          // Pedimos la lista a Google
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
          const data = await response.json();
          
          if (!data.models) throw new Error("No pude obtener la lista de modelos.");

          // Buscamos uno que sirva para generar texto ('generateContent')
          // Preferimos los 'gemini' y evitamos los 'vision' si es solo texto
          const modeloValido = data.models.find(m => 
              m.name.includes('gemini') && 
              m.supportedGenerationMethods.includes('generateContent')
          );

          if (modeloValido) {
              console.log("Modelo encontrado:", modeloValido.name);
              return modeloValido.name.replace('models/', ''); // Limpiamos el nombre
          } else {
              throw new Error("Ningún modelo compatible encontrado.");
          }
      } catch (error) {
          console.error(error);
          return 'gemini-pro'; // Si falla la detección, usamos este por defecto
      }
  };

  // --- PASO 2: USAR ESE MODELO ---
  const consultarGemini = async (pregunta) => {
    try {
        let modeloAUsar = modeloDetectado;

        // Si es la primera vez, buscamos el modelo
        if (!modeloAUsar) {
            modeloAUsar = await encontrarModelo();
            setModeloDetectado(modeloAUsar);
        }

        console.log(`Usando modelo: ${modeloAUsar}`);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modeloAUsar}:generateContent?key=${GEMINI_API_KEY}`;
        
        const ahora = new Date();
        const fechaActual = now => now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const horaActual = now => now.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'});
        const contexto = `Hoy es ${fechaActual(ahora)} y son las ${horaActual(ahora)}.`;

        const prompt = `
          Contexto: ${contexto}
          Eres un asistente útil y amable.
          Usuario: "${pregunta}"
          Instrucciones: Responde en texto plano (sin símbolos raros), breve (máx 3 frases). Si es hora/fecha usa contexto. Si es fútbol/tiendas di que no tienes internet en vivo.
        `;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);
        
        if (data.candidates && data.candidates[0].content) {
            let respuestaIA = data.candidates[0].content.parts[0].text;
            respuestaIA = respuestaIA.replace(/\*/g, '').replace(/#/g, '');

            setContenido(`
                <h2>🤖 Respuesta (${modeloAUsar}):</h2>
                <hr/>
                <p style="font-size: 1.2em; line-height: 1.6;">${respuestaIA}</p>
            `);
            leerRespuesta(respuestaIA);
        } else {
            throw new Error("Sin respuesta.");
        }

    } catch (error) {
        setContenido(`
            <h3>⚠️ ERROR</h3>
            <p>Google ha rechazado la conexión.</p>
            <p style="color:yellow; font-size:0.7em">${error.message}</p>
        `);
        leerRespuesta("Error de conexión con Google.");
    }
    setCargando(false);
  };

  const procesarPregunta = async (textoEntrada = null) => {
    const consulta = textoEntrada || busqueda;
    if (!consulta) return;

    setCargando(true);
    setModoVista('wikipedia'); 
    setMenuAbierto(false);
    
    await consultarGemini(consulta);
  };

  // --- CARGADORES ---
  const cargarFuente = async (fuente) => {
    setMenuAbierto(false);
    if (fuente.tipo === 'esquelas_parser') {
      cargarEsquelas();
      return;
    }
    setCargando(true);
    setModoVista('lista');
    setTituloSeccion(fuente.nombre);
    setListaItems([]);
    const rssUrl = `${fuente.rss}?t=${new Date().getTime()}`;
    const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
    try {
        const respuesta = await fetch(proxyUrl);
        const datos = await respuesta.json();
        if(datos.status === 'ok') {
            const noticiasAdaptadas = datos.items.map(item => ({
              titulo: item.title,
              contenido: `<h3>${item.title}</h3><hr/><div class='cuerpo-noticia'>${item.description}</div>`,
              esEsquela: false
            }));
            setListaItems(noticiasAdaptadas);
        } else {
            setListaItems([]);
            setContenido("<p>NO SE PUDIERON CARGAR LAS NOTICIAS.</p>");
        }
    } catch (error) {
        setContenido("<p>ERROR DE CONEXIÓN.</p>");
    }
    setCargando(false);
  };

  const cargarEsquelas = async () => {
    setCargando(true);
    setModoVista('lista');
    setTituloSeccion("ESQUELAS CANTABRIA");
    setListaItems([]);
    const targetUrl = 'https://www.esquelasdecantabria.com/index.php/esquelas';
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`;
    try {
      const response = await fetch(proxyUrl);
      const data = await response.json();
      if (data.contents) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');
        const filas = Array.from(doc.querySelectorAll('tr'));
        const esquelas = filas.map(fila => {
            const enlace = fila.querySelector('a');
            if (enlace) {
                const texto = enlace.innerText.trim();
                const href = enlace.getAttribute('href');
                if (texto.length > 5 && !texto.includes('Imprimir') && !texto.includes('Email') && !texto.includes('Esquelas')) {
                    return {
                        titulo: "† " + texto.toUpperCase(),
                        link: href.startsWith('http') ? href : "https://www.esquelasdecantabria.com" + href,
                        esEsquela: true
                    };
                }
            }
            return null;
        }).filter(item => item !== null);
        const unicos = esquelas.filter((v,i,a)=>a.findIndex(v2=>(v2.titulo===v.titulo))===i);
        setListaItems(unicos.length > 0 ? unicos : [{titulo: "NO SE ENCONTRARON ESQUELAS HOY", contenido: "", esEsquela: true}]);
      }
    } catch (error) {
      setContenido("<p>ERROR AL CARGAR ESQUELAS.</p>");
    }
    setCargando(false);
  };

  const cargarDetalleEsquela = async (item) => {
      if(!item.link) return;
      setCargando(true);
      setModoVista('lectura');
      setContenido("<h3>CARGANDO INFORMACIÓN...</h3>");
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(item.link)}&timestamp=${Date.now()}`;
      try {
          const response = await fetch(proxyUrl);
          const data = await response.json();
          if (data.contents) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, 'text/html');
            const cuerpo = doc.querySelector('.item-page') || doc.querySelector('[itemprop="articleBody"]') || doc.body;
            const basura = cuerpo.querySelectorAll('script, style, iframe, button, .icons, .actions, .pagenav');
            basura.forEach(b => b.remove());
            const enlaces = cuerpo.querySelectorAll('a');
            enlaces.forEach(a => {
                const span = document.createElement('span');
                span.innerText = a.innerText;
                a.parentNode.replaceChild(span, a);
            });
            setContenido(`<div class="tarjeta-esquela"><h2 class="nombre-difunto">${item.titulo}</h2><hr class="separador-esquela"/><div class="datos-esquela">${cuerpo.innerHTML}</div></div>`);
          }
      } catch (error) {
          setContenido(`<div class="tarjeta-esquela"><h3>${item.titulo}</h3><p>Error al cargar.</p><a href="${item.link}" target="_blank" style="color:yellow; font-size:1.5rem; display:block; margin-top:20px;">VER EN WEB</a></div>`);
      }
      setCargando(false);
  };

  const manejarClick = (item) => {
      if (item.esEsquela) {
          if(item.link) cargarDetalleEsquela(item);
      } else {
          setModoVista('lectura');
          setContenido(item.contenido);
      }
  };

  const leerPantalla = () => {
    window.speechSynthesis.cancel();
    const div = document.createElement("div");
    if(modoVista === 'lista') {
        let texto = `LISTA DE ${tituloSeccion}. `;
        listaItems.forEach(n => texto += n.titulo.replace('†', 'Fallecido ') + ". . ");
        div.textContent = texto;
    } else {
        div.innerHTML = contenido;
    }
    leerRespuesta(div.textContent || div.innerText || "");
  };
  
  const callarVoz = () => { window.speechSynthesis.cancel(); }

  return (
    <div className={`app-contenedor ${altoContraste ? 'modo-noche' : 'modo-dia'}`}>
      
      <header className="barra-superior">
        <div className="sector-izq">
          <button className="btn-menu-hamburguesa" onClick={() => setMenuAbierto(true)}>☰ MENÚ</button>
        </div>
        <div className="sector-centro">
          <h1 className="logo">ELDAPP 👁️</h1>
        </div>
        <div className="sector-der">
          <button className="btn-control" onClick={() => setTamanoLetra(t => Math.max(20, t - 2))}>A-</button>
          <button className="btn-control" onClick={() => setTamanoLetra(t => t + 2)}>A+</button>
          <button className="btn-control btn-modo" onClick={() => setAltoContraste(!altoContraste)}>
            {altoContraste ? '☀️' : '🌑'}
          </button>
        </div>
      </header>

      {menuAbierto && <div className="fondo-oscuro" onClick={() => setMenuAbierto(false)}></div>}
      
      <aside className={`menu-lateral ${menuAbierto ? 'abierto' : ''}`}>
        <div className="cabecera-menu">
          <span>SECCIONES</span>
          <button className="btn-cerrar" onClick={() => setMenuAbierto(false)}>✕ CERRAR</button>
        </div>
        <div className="contenido-menu-flexible">
          <div className="bloque-seccion">
             <h3>PRENSA</h3>
             <div className="grid-botones">
               {menuOpciones.prensa.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
             </div>
          </div>
          <div className="bloque-seccion">
             <h3>DEPORTES</h3>
             <div className="grid-botones">
                {menuOpciones.deportes.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
             </div>
          </div>
          <div className="bloque-seccion destacado">
             <h3>CANTABRIA</h3>
             <div className="grid-botones">
                {menuOpciones.cantabria.map((p, i) => <button key={i} onClick={() => cargarFuente(p)}>{p.nombre}</button>)}
             </div>
          </div>
          <button className="btn-volver-inicio" onClick={() => {setModoVista('inicio'); setMenuAbierto(false); setBusqueda('')}}>🏠 INICIO</button>
        </div>
      </aside>

      <main className="area-principal">
        
        {(modoVista === 'inicio' || modoVista === 'wikipedia') && (
          <>
            <div className="buscador-caja">
              <input type="text" placeholder="ESCRIBIR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && procesarPregunta()}/>
              <button className="btn-buscar" onClick={() => procesarPregunta()}>BUSCAR</button>
            </div>
            
            <Asistente alEscuchar={(texto) => procesarPregunta(texto)} />
          </>
        )}

        {((contenido && modoVista !== 'inicio') || (listaItems.length > 0 && modoVista === 'lista')) && (
          <div className="panel-voz">
             <button onClick={leerPantalla}>🔊 LEER PANTALLA</button>
             <button onClick={callarVoz}>🤫 PARAR</button>
          </div>
        )}

        <div className="visor-texto" style={{ fontSize: `${tamanoLetra}px` }}>
          {cargando && <p className="mensaje-estado">PENSANDO...</p>}
          
          {!cargando && modoVista === 'inicio' && (
             <div className="bienvenida">
               <p>HOLA.</p>
               <p>PUEDES PREGUNTARME LO QUE QUIERAS.</p>
               <ul style={{textAlign:'left', display:'inline-block'}}>
                   <li>"¿Qué tiempo hace?"</li>
                   <li>"¿Cuándo empezó la Guerra Civil?"</li>
                   <li>"¿A qué hora cierra el súper?"</li>
               </ul>
             </div>
          )}

          {!cargando && (modoVista === 'wikipedia' || modoVista === 'lectura') && (
            <div dangerouslySetInnerHTML={{ __html: contenido }} />
          )}

          {!cargando && modoVista === 'lista' && (
            <div className="lista-titulares">
              <h2 className="titulo-periodico">{tituloSeccion}</h2>
              {listaItems.map((item, index) => (
                <button 
                  key={index} 
                  className="btn-titular"
                  style={{ fontSize: `${tamanoLetra - 2}px` }}
                  onClick={() => manejarClick(item)}
                >
                  {item.titulo}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;