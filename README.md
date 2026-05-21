# Encuesta en vivo

Mini app para una encuesta multiple choice con link publico de votacion, pantalla de resultados y panel admin.

## Rutas

- `/`: link publico para votar.
- `/results`: pantalla publica de resultados para mostrar en vivo.
- `/admin?key=TU_CLAVE`: panel admin para cambiar la encuesta, ver QR, resetear votos y administrar historial.

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

La encuesta activa se guarda en `poll-state.json` y el historial en `poll-history.json`. Esos archivos no se suben a Git porque son datos vivos del evento.

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
   - Resultados: `https://tu-dominio.com/results`
   - Admin: `https://tu-dominio.com/admin?key=TU_CLAVE`

Vercel puede servir si luego cambiamos JSON por almacenamiento externo. Para esta version con archivos locales, es mejor usar un servidor Node persistente.
