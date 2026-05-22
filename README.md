# Actividades en vivo

Mini app para actividades en vivo con dos modalidades: encuesta multiple choice y nube de palabras. Tiene links publicos de participacion, pantallas de resultados y panel admin.

## Rutas

- `/encuesta`: link publico para votar encuestas.
- `/nube`: link publico para enviar una palabra o frase de maximo 2 palabras.
- `/encuesta-resultado`: pantalla publica de resultados de encuestas.
- `/nube-resultados`: pantalla publica de nube de palabras.
- `/admin?key=TU_CLAVE`: panel admin para elegir modalidad, cambiar consigna, ver QR, resetear respuestas, restaurar backup y administrar historial.

Las rutas `/` y `/results` quedan como aliases de compatibilidad para encuesta y resultados de encuesta.

## Correr local

```bash
npm start
```

Opcionalmente protege el admin con una clave:

```bash
ADMIN_KEY=mi-clave npm start
```

Si `ADMIN_KEY` esta configurada, las acciones de admin requieren abrir `/admin?key=mi-clave`.

## Persistencia

La actividad activa se guarda en `poll-state.json` y el historial en `poll-history.json`. Esos archivos no se suben a Git porque son datos vivos del evento.

Por defecto se guardan en la raiz del proyecto. En produccion podes configurar `DATA_DIR` para guardarlos en un disco persistente, por ejemplo:

```bash
DATA_DIR=/var/data
```

Para un uso chico, por ejemplo un admin y hasta 20 personas votando, JSON alcanza bien. La condicion importante es correr una sola instancia de la app en un servidor con disco persistente.

## Deploy recomendado

Para mantener esta version simple con JSON:

1. Subir el codigo a GitHub.
2. Deployar en un host Node con disco persistente, como Render, Railway, Fly.io con volumen, una VPS chica o una maquina propia expuesta con dominio/tunel.
3. Configurar `ADMIN_KEY` y `DATA_DIR` en el host.
4. Compartir estos links:
   - Votacion: `https://tu-dominio.com/`
   - Nube: `https://tu-dominio.com/nube`
   - Resultados encuesta: `https://tu-dominio.com/encuesta-resultado`
   - Resultados nube: `https://tu-dominio.com/nube-resultados`
   - Admin: `https://tu-dominio.com/admin?key=TU_CLAVE`

Vercel puede servir si luego cambiamos JSON por almacenamiento externo. Para esta version con archivos locales, es mejor usar un servidor Node persistente.
