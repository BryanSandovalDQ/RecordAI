// misscripts.js

// 1. Pega aquí la clave que obtuviste en console.groq.com
const GROQ_API_KEY = "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";

// Elementos del DOM
const textarea = document.getElementById("recordatorio");
const btnCrear = document.getElementById("btn-crear");
const btnLimpiar = document.getElementById("btn-limpiar");
const seccionInterpretacion = document.getElementById("seccion-interpretacion");
const contenedorInterpretaciones = document.getElementById("contenedor-interpretaciones");
const listaRecordatorios = document.getElementById("lista-recordatorios");

btnCrear.addEventListener("click", procesarRecordatorio);

btnLimpiar.addEventListener("click", () => {
  textarea.value = "";
  textarea.focus();
});

async function procesarRecordatorio() {
  const textoUsuario = textarea.value.trim();

  if (!textoUsuario) {
    alert("Por favor escribe lo que necesitas recordar.");
    return;
  }

  btnCrear.disabled = true;
  btnCrear.innerText = "Procesando con IA...";

  try {
    const recordatorios = await llamarGroq(textoUsuario);

    if (!Array.isArray(recordatorios) || recordatorios.length === 0) {
      alert("No se identificaron recordatorios claros. Intenta indicar la hora o el día.");
      return;
    }

    renderizarInterpretacion(recordatorios);
    agregarALaLista(recordatorios);
    textarea.value = "";
  } catch (error) {
    console.error("Detalle del error:", error);
    alert("Ocurrió un problema:\n" + error.message);
  } finally {
    btnCrear.disabled = false;
    btnCrear.innerText = "Crear recordatorio";
  }
}

async function llamarGroq(instruccion) {
  const urlCompletions = "https://api.groq.com/openai/v1/chat/completions";

  const promptSistema = `
Eres el asistente médico y de memoria de RecordIA para adultos mayores.
Analiza la entrada y extrae todos los recordatorios o tareas individuales.
Si el usuario indica repeticiones o frecuencias (ej: "cada 8 horas hoy", o "1 pastilla diaria por 3 días"), genera un elemento individual por cada evento.

Responde ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:
{
  "recordatorios": [
    {
      "actividad": "descripción concreta de la tarea",
      "fecha": "Hoy / Mañana / día correspondiente",
      "hora": "HH:MM (formato 24h, o '--:--' si no se indica)"
    }
  ]
}
`;

  // Modelos principales activos en Groq
  let modelosAProbar = ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"];

  // Intentamos primero con los modelos conocidos
  for (const modelo of modelosAProbar) {
    try {
      const payload = {
        model: modelo,
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: instruccion }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      };

      const res = await fetch(urlCompletions, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) continue;

      const data = await res.json();
      const contenido = data.choices?.[0]?.message?.content;
      if (contenido) {
        const parsed = JSON.parse(contenido);
        return parsed.recordatorios || [];
      }
    } catch (e) {
      // Intenta con el siguiente
    }
  }

  // Si ninguno de la lista funcionó, consultamos a Groq qué modelos tiene tu cuenta
  const resModels = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { "Authorization": `Bearer ${GROQ_API_KEY}` }
  });

  if (resModels.ok) {
    const listData = await resModels.json();
    // Filtramos un modelo de texto que no sea whisper
    const modeloValido = listData.data?.find(m => !m.id.includes("whisper") && !m.id.includes("guard"))?.id;

    if (modeloValido) {
      const payload = {
        model: modeloValido,
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: instruccion }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      };

      const res = await fetch(urlCompletions, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        const contenido = data.choices?.[0]?.message?.content;
        return JSON.parse(contenido).recordatorios || [];
      }
    }
  }

  throw new Error("No se encontró ningún modelo activo disponible en tu cuenta de Groq.");
}

function renderizarInterpretacion(recordatorios) {
  if (!contenedorInterpretaciones) return;
  contenedorInterpretaciones.innerHTML = "";

  recordatorios.forEach(item => {
    const tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta interpretacion";
    tarjeta.style.marginBottom = "14px";

    tarjeta.innerHTML = `
      <dl class="datos-recordatorio">
        <div>
          <dt>Actividad</dt>
          <dd>${item.actividad || "Sin descripción"}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>${item.fecha || "No especificada"}</dd>
        </div>
        <div>
          <dt>Hora</dt>
          <dd>${item.hora || "--:--"}</dd>
        </div>
      </dl>
      <p class="estado"><span aria-hidden="true">✓</span> Listo para recordar</p>
    `;
    contenedorInterpretaciones.appendChild(tarjeta);
  });

  if (seccionInterpretacion) {
    seccionInterpretacion.style.display = "block";
  }
}

function agregarALaLista(recordatorios) {
  if (!listaRecordatorios) return;

  recordatorios.forEach(item => {
    const elemento = document.createElement("article");
    elemento.className = "recordatorio";

    const fechaTexto = item.fecha && item.fecha !== "Hoy" ? ` (${item.fecha})` : "";

    elemento.innerHTML = `
      <span class="recordatorio__indicador" aria-hidden="true">✓</span>
      <time datetime="${item.hora}">${item.hora || "--:--"}</time>
      <p>${item.actividad || "Recordatorio"}${fechaTexto}</p>
    `;

    listaRecordatorios.prepend(elemento);
  });
}