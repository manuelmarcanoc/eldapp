import React, { useState } from 'react';
import './App.css';

function App() {
  const [busqueda, setBusqueda] = useState('');
  const [contenido, setContenido] = useState('');
  const [tamanoLetra, setTamanoLetra] = useState(28); 
  const [altoContraste, setAltoContraste] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  
  const [modoVista, setModoVista] = useState('inicio'); 
  const [listaItems, setListaItems] = useState([]);
  const [tituloSeccion, setTituloSeccion] = useState('');

  // --- CONFIGURACIÓN DE MEDIOS ---
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

  // --- NUEVO BUSCADOR WIKIPEDIA INTELIGENTE ---
  const buscarEnWikipedia = async () => {
    if (!busqueda) return;
    setCargando(true);
    setModoVista('wikipedia');
    setMenuAbierto(false);
    
    // 1. PRIMERO BUSCAMOS COINCIDENCIAS (SEARCH)
    const urlBusqueda = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${busqueda}&format=json&origin=*`;

    try {
      const resBusqueda = await fetch(urlBusqueda);
      const dataBusqueda = await resBusqueda.json();

      if (dataBusqueda.query.search.length === 0) {
        setContenido("<p>NO SE ENCONTRÓ NADA. INTENTA OTRA PALABRA.</p>");
        setCargando(false);
        return;
      }

      // Cogemos el título del primer resultado (el más relevante)
      const mejorResultado = dataBusqueda.query.search[0].title;

      // 2. AHORA PEDIMOS EL CONTENIDO DE ESE TÍTULO EXACTO
      const urlContenido = `https://es.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(mejorResultado)}&format=json&origin=*`;
      
      const resContenido = await fetch(urlContenido);
      const dataContenido = await resContenido.json();
      const paginas = dataContenido.query.pages;
      const pageId = Object.keys(paginas)[0];

      if (pageId === "-1") {
        setContenido("<p>ERROR AL CARGAR EL ARTÍCULO.</p>");
      } else {
        // Formateamos un poco el texto para que se lea mejor
        const texto = paginas[pageId].extract;
        const html = `
          <h2>${mejorResultado.toUpperCase()}</h2>
          <hr/>
          <div style="line-height: 1.6; font-size: 1.1em;">
            ${texto.split('\n').map(p => `<p>${p}</p>`).join('')}
          </div>
        `;
        setContenido(html);
      }

    } catch (error) {
      setContenido("<p>ERROR DE CONEXIÓN CON WIKIPEDIA.</p>");
    }
    setCargando(false);
  };

  // --- CARGADOR DE NOTICIAS RSS ---
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

  // --- CARGADOR DE ESQUELAS ---
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

        if (unicos.length > 0) {
            setListaItems(unicos);
        } else {
            setListaItems([{titulo: "NO SE ENCONTRARON ESQUELAS HOY", contenido: "", esEsquela: true}]);
        }
      }
    } catch (error) {
      setContenido("<p>ERROR AL CARGAR ESQUELAS.</p>");
    }
    setCargando(false);
  };

  // --- DETALLE ESQUELA ---
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

            const textoLimpio = cuerpo.innerHTML;

            setContenido(`
                <div class="tarjeta-esquela">
                    <h2 class="nombre-difunto">${item.titulo}</h2>
                    <hr class="separador-esquela"/>
                    <div class="datos-esquela">
                        ${textoLimpio}
                    </div>
                </div>
            `);
          }
      } catch (error) {
          setContenido(`
            <div class="tarjeta-esquela">
                <h3>${item.titulo}</h3>
                <p>No se pudo cargar el detalle automáticamente.</p>
                <a href="${item.link}" target="_blank" style="color:yellow; font-size:1.5rem; display:block; margin-top:20px;">VER EN WEB</a>
            </div>
          `);
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

  const leerVoz = () => {
    window.speechSynthesis.cancel();
    const div = document.createElement("div");
    if(modoVista === 'lista') {
        let texto = `LISTA DE ${tituloSeccion}. `;
        listaItems.forEach(n => texto += n.titulo.replace('†', 'Fallecido ') + ". . ");
        div.textContent = texto;
    } else {
        div.innerHTML = contenido;
    }
    const textoLimpio = div.textContent || div.innerText || "";
    const voz = new SpeechSynthesisUtterance(textoLimpio);
    voz.lang = 'es-ES';
    voz.rate = 0.9; 
    window.speechSynthesis.speak(voz);
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
          <div className="buscador-caja">
            <input type="text" placeholder="BUSCAR..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && buscarEnWikipedia()}/>
            <button className="btn-buscar" onClick={buscarEnWikipedia}>BUSCAR</button>
          </div>
        )}

        {((contenido && modoVista !== 'inicio') || (listaItems.length > 0 && modoVista === 'lista')) && (
          <div className="panel-voz">
             <button onClick={leerVoz}>🔊 LEER</button>
             <button onClick={callarVoz}>🤫 PARAR</button>
          </div>
        )}

        <div className="visor-texto" style={{ fontSize: `${tamanoLetra}px` }}>
          {cargando && <p className="mensaje-estado">CARGANDO...</p>}
          
          {!cargando && modoVista === 'inicio' && (
             <div className="bienvenida">
               <p>HOLA.</p>
               <p>USA EL <strong>MENÚ ARRIBA A LA IZQUIERDA</strong> PARA LEER NOTICIAS O ESQUELAS.</p>
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