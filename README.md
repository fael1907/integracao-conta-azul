# Integração Conta Azul → Google Sheets

Script em **Google Apps Script** que conecta o ERP **Conta Azul** à planilha financeira da empresa. Todo dia de manhã, ele busca na API os saldos pendentes de **contas a receber** e **contas a pagar** e atualiza o Balanço Patrimonial, sem ninguém digitar nada.

> Versão pública de uma integração que construí na **Ayra Consultoria** (empresa júnior de gestão da UFRJ). Credenciais e dados reais não estão no repositório.

## Problema

Os saldos de contas a receber e a pagar ficavam no Conta Azul, mas o Balanço Patrimonial e os relatórios financeiros eram montados na planilha. Alguém precisava consultar o ERP e copiar os valores à mão. Com isso, o balanço podia ficar desatualizado ou com erro de digitação.

## Solução

```
Gatilho diário (6h) → OAuth 2.0 → API v2 do Conta Azul → totais pendentes → Balanço Patrimonial na planilha
```

- **Autenticação OAuth 2.0** com a biblioteca oficial de OAuth2 para Apps Script. O token é renovado automaticamente.
- **Credenciais fora do código**: client id e client secret ficam nas Propriedades do Script.
- **Atualização diária** por gatilho, com erro claro no log se a API responder com falha.
- **Função de diagnóstico** que mostra todos os totais da API (pago, vencido, vence hoje, pendente, aberto) para conferir os números com o ERP.

## Impacto

- Balanço Patrimonial sempre com os saldos do dia, direto do ERP.
- Fim da digitação manual de valores financeiros entre sistemas.

## Como usar

1. Crie um app no portal de desenvolvedores do Conta Azul.
2. Na planilha, abra **Extensões → Apps Script**, cole `src/conta_azul.gs` e adicione a biblioteca **OAuth2 for Apps Script**.
3. Em **Configurações do projeto → Propriedades do script**, crie `CA_CLIENT_ID` e `CA_CLIENT_SECRET`.
4. Rode `mostrarRedirectUri()` e cadastre a URL que aparecer no log no app do Conta Azul.
5. Rode `autorizar()`, abra o link do log e autorize o acesso.
6. Ajuste as abas e células de destino no topo do arquivo e rode `criarGatilhoDiario()` uma vez.

## Como usei IA

Usei o **Claude Code** para entender a documentação da API v2 do Conta Azul e montar o fluxo de OAuth 2.0, que exigia um cabeçalho de autenticação específico na troca do token. Validei os valores com a função de diagnóstico, comparando com o painel do ERP.

---
Rafael Avila · Economia UFRJ
