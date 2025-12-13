import React, { useState } from 'react';

const Asistente = ({ alEscuchar }) => {
  const [escuchando, setEscuchando] = useState(false);
  const [mensaje, setMensaje] = useState("ASISTENTE DE VOZ 🎙️");

  // Configuración del reconocimiento de voz
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Si el navegador no soporta voz, no mostramos nada
  if (!SpeechRecognition) return null;

  const reconocimiento = new SpeechRecognition();
  reconocimiento.lang = 'es-ES';
  reconocimiento.continuous = false;

  const empezarA_Escuchar = () => {
    setEscuchando(true);
    setMensaje("TE ESCUCHO... 👂");
    reconocimiento.start();
  };

  reconocimiento.onresult = (event) => {
    const textoEscuchado = event.results[0][0].transcript;
    setMensaje(`HAS DICHO: "${textoEscuchado.toUpperCase()}"`);
    setEscuchando(false);
    
    // IMPORTANTE: Aquí pasamos el texto a App.js para que lo piense
    if (alEscuchar) {
        alEscuchar(textoEscuchado); 
    }
  };

  reconocimiento.onerror = () => {
    setEscuchando(false);
    setMensaje("NO TE HE ENTENDIDO 😕");
  };

  return (
    <div style={{
        backgroundColor: '#111', 
        padding: '20px', 
        borderRadius: '15px', 
        margin: '20px auto', 
        maxWidth: '600px',
        textAlign: 'center',
        border: '1px solid #333'
    }}>
      <h3 style={{color:'white', margin:'0 0 15px 0'}}>{mensaje}</h3>
      
      <button 
        onClick={empezarA_Escuchar} 
        style={{
            backgroundColor: escuchando ? '#dc3545' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '15px 40px',
            fontSize: '22px',
            borderRadius: '50px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 0 rgba(0,0,0,0.5)'
        }}
      >
        {escuchando ? "PARAR" : "PREGUNTAR"}
      </button>
    </div>
  );
};

export default Asistente;