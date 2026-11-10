# Publicação e ambiente

- Publicar **só com pedido do dono**. A prévia de teste não altera a produção, mas usa **o mesmo banco D1 e as mesmas fotos R2**.
- A sessão do Claude na nuvem **não consegue publicar**: o envio dos arquivos do app ao Cloudflare usa um token temporário que o proxy da sessão substitui (erro 401). Por isso, o dono publica pelo computador dele.
- O push para o GitHub funciona depois que o app do Claude foi instalado no repositório.

## Passo a passo no Windows (PowerShell), na pasta do projeto

```
git pull
cd laser-check
npm.cmd install            (só quando as dependências mudarem)
npx.cmd wrangler versions upload --config backend/wrangler.jsonc --preview-alias cl-version
```

- Use `npm.cmd` e `npx.cmd`: o PowerShell bloqueia os scripts `npm`/`npx` sem a extensão.
- Link fixo da prévia: https://cl-version-valida-laser.iuranhumberto99.workers.dev
- Para conferir se subiu a versão certa: o campo `build` do diagnóstico termina com o nome do `app-*.js` que está em `frontend/dist/index.html`.
- Publicar na produção (só com pedido): `npx.cmd wrangler deploy --config backend/wrangler.jsonc`.
