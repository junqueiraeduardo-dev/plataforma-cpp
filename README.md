# Casa em Dia

Painel para controlar os gastos de uma casa com vários moradores, dividir as contas e acompanhar assinaturas em um cofre de notas no estilo Obsidian.

## Rodar

```bash
npm install
npm run dev
```

Outros comandos: `npm run build` (verifica tipos e gera `dist/`), `npm run preview`, `npm run lint`, `npx vitest run`, `./scripts/build-artifact.sh` (variante para página incorporada, em `dist-artifact/`).

Na primeira abertura o aplicativo cria uma casa de exemplo (3 moradores, 6 meses de gastos, 13 assinaturas). Para recomeçar do zero ou restaurar o exemplo, use **Ajustes**.

## Telas

| Rota | O que faz |
|---|---|
| `/` | Visão geral: gasto acumulado do mês contra o mês anterior e o teto do orçamento, uso do orçamento, custo de assinaturas, acerto entre moradores, gastos por categoria, avisos e próximas cobranças |
| `/gastos` | Lançamentos do mês com filtros; cada gasto tem quem pagou, a divisão (igual, percentual ou valores exatos) e um ícone reconhecido pela descrição |
| `/mercado` | Lista de compras escrita pelo usuário: aceita vários itens de uma vez, quantidade (`2 leite`) e medida (`2 kg tomate`); separa por seção e sugere o que a casa já escreveu |
| `/orcamentos` | Limite mensal por categoria e histórico de seis meses |
| `/moradores` | Saldo de cada morador e as transferências que zeram as contas |
| `/assinaturas` | Galeria de cartões (agrupar, ordenar e organizar à mão), notas em Markdown com propriedades, `[[wikilinks]]` e backlinks, e grafo |
| `/ajustes` | Aparência (temas prontos e cores próprias), backup em JSON, dados de exemplo e limpeza |

## Como está organizado

```
src/
  domain/      regras puras e testadas: dinheiro em centavos, divisão, acerto,
               cobranças de assinatura, wikilinks e grafo, avisos
  data/        repository.ts (interface), localRepository.ts (localStorage),
               schema.ts (validação Zod), seed.ts (dados de exemplo)
  store/       estado (Zustand) e seletores derivados
  features/    uma pasta por tela
  components/  ui/ (shadcn e Magic UI), reactbits/ (React Bits), charts/, common/
```

Decisões que valem saber:

- **Dinheiro é sempre inteiro, em centavos.** A divisão distribui os centavos que sobram, de modo que a soma das partes sempre fecha com o total.
- **Assinatura gera gasto.** Cada cobrança de uma assinatura ativa entra como gasto da categoria Assinaturas na data certa, com quem paga e quem divide. Não é preciso lançar à mão.
- **O grafo é derivado.** O modo padrão, "Quem paga", põe cada pagador no centro do seu grupo e as assinaturas dele em anel; a disposição é calculada (`src/domain/payerLayout.ts`), não simulada, então os grupos nunca se sobrepõem e ficam a uma folga fixa um do outro. O modo "Ligações" é o grafo livre: as ligações vêm dos `[[links]]` do texto e das propriedades da assinatura (quem paga, quem divide, grupo, forma de pagamento). Link para nota inexistente vira nó tracejado; clicar nele cria a nota.
- **Renomear uma nota atualiza os links** que apontam para ela.
- **Registro de gasto.** "Novo gasto" pede o valor e um toque no tipo (Luz, Mercado, Farmácia…); o tipo tocado grava o ícone junto com o gasto. A descrição é opcional e entende frases: `pizza 89,90 ontem bruno` vira descrição, valor, data, categoria e pagador (`src/domain/quickAdd.ts`). As mesmas regras de `src/domain/expenseRules.ts` definem o ícone e a categoria sugerida.
- **Três layouts.** Abaixo de 768 px: barra inferior com quatro destinos, "Mais" e botão flutuante; formulários em folha que sobe da base. De 768 a 1279 px: barra lateral estreita. A partir de 1280 px: barra lateral completa. Controles têm 44 px de altura no celular (utilitários `ctl*` em `src/index.css`).
- **Telas sob demanda.** Só a Visão geral vem no pacote inicial; gráficos, editor de notas e grafo ficam em pacotes separados.
- **Cinco cores definem o tema.** Fundo, cartões, texto, destaque e marca ficam em `src/domain/theme.ts`; o resto é derivado no CSS com `color-mix`, então qualquer combinação clara ou escura funciona. Ajustes avisa quando uma combinação fica com pouco contraste.
- **Ícone de assinatura.** Pelo nome, usa o logotipo da biblioteca simple-icons. Marcas que saíram das versões novas da biblioteca (Microsoft, Amazon, Adobe, Nintendo, Xbox, Canva, OpenAI, Slack, LinkedIn…) usam o desenho da versão 8, instalada como `simple-icons-legacy`; a lista fica em `scripts/brands.json` e `node scripts/gen-brands.mjs` regenera os dados. Os logotipos são marcas dos respectivos donos e servem aqui só para identificar o serviço; antes de publicar o app comercialmente, confira as regras de uso de cada marca. Serviços sem logotipo em nenhuma versão (Disney+, Globoplay, Smart Fit…) ganham um selo com as letras e a cor da marca, e o usuário pode enviar a imagem do logotipo.
- **Foto do morador.** A imagem enviada é recortada em quadrado e reduzida a 128 px no próprio navegador antes de ser guardada com os demais dados.
- **Troca de mês.** Os totais deslizam do valor anterior ao novo (`AnimatedNumber`) e o conteúdo do mês entra pelo lado da navegação (`Swap`), só com opacidade e transformação.

## Levar os dados para a nuvem

Telas e store só falam com a interface `Repository` (`src/data/repository.ts`). Para sincronizar com o Supabase:

1. crie as tabelas `members`, `transactions`, `budgets`, `settlements` e `notes` espelhando `src/data/schema.ts` (todas já têm `id` UUID e `household_id`);
2. implemente `SupabaseRepository` com os mesmos cinco métodos;
3. troque a instância exportada em `src/data/index.ts`.

Autenticação e regras de acesso por casa (RLS) fazem parte desse passo e ainda não existem aqui.

## Componentes de terceiros

- **React Bits** (`src/components/reactbits`): Aurora, SpotlightCard, CountUp, BlurText, AnimatedList, ClickSpark.
- **Magic UI** (`src/components/ui`): NumberTicker, BorderBeam, AnimatedCircularProgressBar.
- **shadcn/ui**: botões, diálogos, campos, seletores.
- O painel em células da Visão geral foi inspirado no componente "builder OS bento" do 21st.dev (células que inclinam com o ponteiro, barra segmentada, anel de progresso), reescrito para este projeto.

O registro do 21st.dev exige conta autenticada para instalar componentes pela linha de comando; por isso os componentes vêm das fontes públicas acima.
