/**
 * Integração Conta Azul (ERP) -> Google Sheets
 *
 * Busca na API v2 do Conta Azul o total pendente de contas a receber e de
 * contas a pagar e grava os valores nas células do Balanço Patrimonial da
 * planilha financeira. Roda sozinho todo dia de manhã.
 *
 * Requisitos:
 *   - Biblioteca OAuth2 for Apps Script (Bibliotecas > "+" > ID da biblioteca
 *     oficial apps-script-oauth2).
 *   - Propriedades do script (Configurações do projeto > Propriedades do script):
 *       CA_CLIENT_ID      -> client id do app no portal de desenvolvedores Conta Azul
 *       CA_CLIENT_SECRET  -> client secret do mesmo app
 *     As credenciais nunca ficam no código.
 */

// ----------------------- CONFIGURAÇÃO -----------------------
// Onde cada total é gravado na planilha. Ajuste para a sua estrutura.
const DESTINO_CONTAS_A_RECEBER = { aba: '8.1 Base do BP', celula: 'B40' };
const DESTINO_CONTAS_A_PAGAR = { aba: '8. Balanço Patrimonial', celula: 'E11' };

const CA_API_BASE = 'https://api-v2.contaazul.com/v1/financeiro/eventos-financeiros';
const FILTRO_PERIODO = '?pagina=1&tamanho_pagina=1&data_vencimento_de=2020-01-01&data_vencimento_ate=2030-12-31';

// ----------------------- AUTENTICAÇÃO (OAuth 2.0) -----------------------
function getContaAzulService() {
  const props = PropertiesService.getScriptProperties();
  const clientId = props.getProperty('CA_CLIENT_ID');
  const clientSecret = props.getProperty('CA_CLIENT_SECRET');
  const basicAuth = Utilities.base64Encode(clientId + ':' + clientSecret);

  return OAuth2.createService('ContaAzul')
    .setAuthorizationBaseUrl('https://login.contaazul.com/#/oauth/authorize')
    .setTokenUrl('https://api-v2.contaazul.com/oauth/token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction('authCallback')
    .setPropertyStore(props)
    .setScope('openid profile aws.cognito.signin.user.admin')
    .setTokenHeaders({
      'Authorization': 'Basic ' + basicAuth,
      'Content-Type': 'application/x-www-form-urlencoded'
    });
}

function authCallback(request) {
  const service = getContaAzulService();
  const authorized = service.handleCallback(request);
  return HtmlService.createHtmlOutput(authorized ? 'Autorizado! Pode fechar essa aba.' : 'Acesso negado.');
}

/** Mostra no log a URL de retorno que precisa ser cadastrada no app do Conta Azul. */
function mostrarRedirectUri() {
  Logger.log(getContaAzulService().getRedirectUri());
}

/** Rodar uma vez: mostra o link para autorizar o acesso à conta do Conta Azul. */
function autorizar() {
  const service = getContaAzulService();
  Logger.log(service.hasAccess() ? 'Já autorizado!' : 'Abra: ' + service.getAuthorizationUrl());
}

// ----------------------- CONSULTA À API -----------------------
/**
 * Consulta um endpoint de eventos financeiros e devolve o JSON da resposta.
 * @param {string} tipo 'contas-a-receber' ou 'contas-a-pagar'
 */
function buscarEventosFinanceiros_(tipo) {
  const service = getContaAzulService();
  if (!service.hasAccess()) throw new Error('Não autorizado. Rode a função autorizar().');

  const url = CA_API_BASE + '/' + tipo + '/buscar' + FILTRO_PERIODO;
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + service.getAccessToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Erro ' + res.getResponseCode() + ' ao consultar ' + tipo + ': ' + res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

function gravarValor_(destino, valor) {
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(destino.aba).getRange(destino.celula).setValue(valor);
}

// ----------------------- ATUALIZAÇÕES -----------------------
function atualizarContasAReceber() {
  const valor = buscarEventosFinanceiros_('contas-a-receber').totais.pendente.valor;
  Logger.log('Contas a Receber (pendente): ' + valor);
  gravarValor_(DESTINO_CONTAS_A_RECEBER, valor);
}

function atualizarContasAPagar() {
  const valor = buscarEventosFinanceiros_('contas-a-pagar').totais.pendente.valor;
  Logger.log('Contas a Pagar (pendente): ' + valor);
  gravarValor_(DESTINO_CONTAS_A_PAGAR, valor);
}

/** Atualiza os dois saldos. É esta função que o gatilho diário chama. */
function atualizarSaldos() {
  atualizarContasAReceber();
  atualizarContasAPagar();
}

/** Mostra no log todos os totais que a API devolve (útil para conferir os números). */
function diagnosticarContasAReceber() {
  const data = buscarEventosFinanceiros_('contas-a-receber');
  Logger.log('itens_totais: ' + data.itens_totais);
  Logger.log('pago: ' + data.totais.pago.valor);
  Logger.log('vencido: ' + data.totais.vencido.valor);
  Logger.log('vence_hoje: ' + data.totais.vence_hoje.valor);
  Logger.log('pendente: ' + data.totais.pendente.valor);
  Logger.log('aberto: ' + data.totais.aberto.valor);
  Logger.log('todos: ' + JSON.stringify(data.totais.todos));
}

// ----------------------- AGENDAMENTO -----------------------
/** Rodar uma vez: agenda a atualização diária às 6h (remove gatilhos antigos antes). */
function criarGatilhoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['atualizarSaldos', 'atualizarContasAPagar'].indexOf(t.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('atualizarSaldos').timeBased().everyDays(1).atHour(6).create();
}
