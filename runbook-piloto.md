# Runbook do piloto de anúncios e recrutamento

Piloto de 7 dias e R$200 no Meta/Instagram para achar testadores do teste fechado do Aurora (o Google Play exige 12 testadores optados por 14 dias seguidos). Quem opera é o gestor. Nenhum dado de candidato entra neste repo.

## Termos

- **Portão do teste fechado:** condição que libera captação e campanha. Na landing, é o valor `FORMS_URL` em `index.html`: vazio = fechada, preenchido com a URL do Forms = aberta.
- **Cadastro qualificado:** resposta do Forms com Android confirmado, aceite do teste dado e e-mail ainda não contado (uma pessoa conta uma vez, mesmo que responda de novo).
- **Custo por cadastro qualificado:** gasto do piloto dividido pelos cadastros qualificados.

## Pré-voo

O Portão só abre com os cinco itens marcados. Marque aqui, no seu controle (não commite marcações com e-mail ou captura).

- [ ] Faixa fechada da #929 ativa no Play Console, com o link de opt-in em mãos (sem isso a landing não pode abrir).
- [ ] Política pública de privacidade no ar com a seção "Recrutamento de testadores" (confira a URL pública e o título).
- [ ] Landing no ar na URL das Pages, ainda fechada, abrindo no celular.
- [ ] URL do Forms conferida: abre pedindo login Google, coleta e-mail verificado e tem as 3 perguntas (ver "Google Forms" abaixo).
- [ ] Perfil profissional do Instagram criado e ligado ao Gerenciador de Anúncios do Meta (pré-requisito manual do gestor).

Regra: o Portão só abre com os cinco marcados. Depois de abrir, cole a URL do Forms em `FORMS_URL`, faça o commit em `main` e confira a landing no ar.

### Item de pré-voo com evidência manual: orçamento

Antes de ativar a campanha, configure no Meta e guarde uma captura da configuração fora do repo (pasta do gestor, nunca em repo):

- orçamento total de R$200 para a campanha inteira;
- data de fim 7 dias depois do início;
- aumento automático de orçamento desligado.

A captura é a evidência de que o teto foi respeitado.

## Google Forms

Crie o formulário na conta Google do gestor (risco residual aceito: respostas na conta pessoal; 20 a 40 e-mails).

- Em Configurações > Respostas: coletar e-mails = **Verificado** (exige login Google). Desligue "Enviar aos respondentes uma cópia".
- Exatamente 3 perguntas:
  1. "Uso um celular Android" (caixa de seleção única, obrigatória);
  2. aceite do teste fechado (obrigatória): "Aceito participar do teste fechado do Aurora por 14 dias seguidos e continuar inscrito até o fim.";
  3. "Avise-me quando o Aurora for lançado" (opcional, desmarcada por padrão).
- Descrição do formulário com o link da política de privacidade pública.
- Respostas ficam só no Google Forms; não vincule planilha.

## Execução do piloto

1. Marque os cinco itens do pré-voo e guarde a captura do orçamento.
2. Abra o Portão (cole a URL do Forms em `FORMS_URL`) e ative a campanha.
3. Cadastre à mão, no Play Console, os Gmails dos cadastros qualificados e mande o convite do kit (`kit/convite.md`).
4. Envie os lembretes dos dias 0, 3, 7 e 12 do kit a quem foi cadastrado.
5. Registre diariamente no registro do piloto: gasto, impressões e cadastros qualificados do dia. Só contagens e gasto, nenhum e-mail.

## Decisão aos 7 dias

Calcule o custo por cadastro qualificado (gasto dividido por cadastros qualificados) e decida:

| Custo por cadastro qualificado | O que fazer |
| --- | --- |
| Até R$10 | Continua dentro do teto de R$200 até acabar a verba. |
| Acima de R$10 | Tenta lead nativo do Meta (formulário do próprio anúncio) no mesmo teto de R$200, ou encerra o piloto. |
| Qualquer valor, com pedido de verba extra | Só com aprovação escrita do gestor na issue #948. |

Em qualquer saída, o piloto encerra ao fim da verba de R$200 ou dos 7 dias, o que vier primeiro.

## Dados e apagamento

- Exportações das respostas ficam fora de qualquer repo (pasta pessoal do gestor). O `.gitignore` deste repo barra `*.csv`, `*.xlsx` e `exports/`.
- O registro do piloto guarda só contagens e gasto, nenhum e-mail.
- Apagamento: apague as respostas em até 30 dias após o fim do teste fechado ou do pedido de saída de quem pediu. Para a lista de aviso de lançamento, apague em até 30 dias após o lançamento.
- Pedidos de saída chegam por aleobons@gmail.com: apague a resposta no Forms e confirme por e-mail.

## Contingência

Se o Forms deixar de aceitar respostas ou o Meta reprovar o anúncio, faça nesta ordem: pausar a campanha e devolver a landing ao estado fechado.

1. Pause a campanha no Gerenciador de Anúncios.
2. Devolva a landing ao estado fechado: apague a URL entre as aspas de `FORMS_URL` em `index.html`, faça o commit em `main` e confira a mensagem "As inscrições ainda não abriram. Volte em breve."
3. Se foi reprovação do Meta, corrija o criativo (rode `kit/check.sh`) e peça nova análise antes de reativar.
