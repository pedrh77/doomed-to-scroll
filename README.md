# Doomed to Scroll

Roguelite casual mobile escondido em um feed vertical. Passe posts sem custo ou interaja para revelar eventos e minigames.

## Executar

Abra `index.html` diretamente ou inicie um servidor local:

```powershell
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Controles

- Role ou deslize verticalmente: avançar ao próximo post
- Arraste a imagem para cima: o card acompanha o gesto e abre o próximo post
- Toque na ação lateral ou dê dois toques na imagem: interagir
- Cada rolagem gasta `0,25` de Energia; interações gastam mais
- Toque em um item da Mochila para consumir seu efeito
- Todos os minigames possuem controles visuais para toque e mouse
- Cards de monstro iniciam uma contagem regressiva automática
- Primeira partida apresenta um tutorial curto de três passos

O progresso entre partidas usa `localStorage`.

## Conteúdo atual

- 29 posts reais carregados de `assets/posts`
- Cards configuráveis com cinco raridades e geração ponderada
- Vida, Energia, moedas, progressão da noite e persistência local
- 20 minigames de toque: Tap Challenge, Sequence, Timing, Swipe Direction, Hold, Reaction, Fake Button, Memory Grid, Trace, Balance, Drag Item, Sort, Rhythm, Lockpick, Dodge, Stop Signal, Multi-stage, Choice, Bargain e Sacrifice
- Risco e recompensa visíveis antes de cada interação
- Comentários contextuais e posts salvos de forma persistente
- Escolhas capazes de alterar raridade, risco e custo dos próximos cards
- Noite 1 com 15 posts; cada noite seguinte adiciona 3, até o limite de 30
- Slime, fantasma, bruxa e outros inimigos iniciam disputas automáticas
- Animações de entrada, arrasto, Energia, recompensa e inventário
- Proteção contra interação e recompensa duplicadas
- Loja com oito cosméticos puramente visuais

## Testes

```powershell
node --test tests/game-core.test.js
```
