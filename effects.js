
// ======================================================
// UTILITÁRIOS (REVISADO E BLINDADO)
// ======================================================
const EFFECT_UTILS = {
  // Retorna todas as unidades do jogador que possuem uma carta válida
  getPlayerUnits() {
    const zones = ["bancoPlayer", "campo1", "campo2"];
    const result = [];

    zones.forEach(zone => {
      // Uso de Optional Chaining (?.) garante que se window.board não existir, o código não quebra
      (window.board?.[zone] || []).forEach(unit => {
        if (unit?.owner === "player" && unit?.card) {
          result.push(unit);
        }
      });
    });

    return result;
  },

  // Retorna todas as unidades do inimigo que possuem uma carta válida
  getEnemyUnits() {
    const zones = ["bancoEnemy", "campo2", "campo1"];
    const result = [];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        // Verifica estritamente se não pertence ao player (captura "enemy", "bot", etc.)
        if (unit?.owner && unit.owner !== "player" && unit?.card) {
          result.push(unit);
        }
      });
    });

    return result;
  },

  // Busca uma unidade ativa do player priorizando o Campo 2 -> Campo 1 -> Banco
  getPlayerActive() {
    if (!window.board) return null;
    return (
      window.board.campo2?.find(u => u?.owner === "player") ||
      window.board.campo1?.find(u => u?.owner === "player") ||
      window.board.bancoPlayer?.find(u => u?.owner === "player") ||
      null
    );
  },

  // Busca uma unidade ativa do inimigo priorizando o Campo 2 -> Banco (E adicionado campo1 por segurança)
  getEnemyActive() {
    if (!window.board) return null;
    return (
      window.board.campo2?.find(u => u?.owner && u.owner !== "player") ||
      window.board.campo1?.find(u => u?.owner && u.owner !== "player") || // Adicionado para espelhar consistência
      window.board.bancoEnemy?.find(u => u?.owner && u.owner !== "player") ||
      null
    );
  },

  // Atalho para pegar a prioridade máxima do jogador em campo
  getFirstPlayerUnit() {
    return this.getPlayerActive(); // Reutiliza a lógica limpa acima
  },

  // Atalho para pegar a prioridade máxima do inimigo em campo
  getFirstEnemyUnit() {
    return this.getEnemyActive(); // Reutiliza a lógica limpa acima
  },

  // Remove unidades mortas da mesa chamando os métodos disponíveis do motor do jogo
  cleanup(ctx) {
    if (typeof ctx?.cleanupDead === "function") {
      ctx.cleanupDead();
      return;
    }

    if (typeof window.cleanupDeadUnits === "function") {
      window.cleanupDeadUnits();
    }
  },

  // Exibe alertas visuais na interface se a função global existir
  warn(text) {
    if (typeof window.showWarning === "function") {
      window.showWarning(text);
    } else {
      console.warn(`[Aviso do Jogo]: ${text}`); // Fallback caso a janela de UI mude
    }
  },

  // Verifica se uma carta está congelada com base no turno atual do jogo
  isFrozen(card) {
    // Garante um valor numérico padrão caso turnNumber venha indefinido
    const currentTurn = typeof window.turnNumber === 'number' ? window.turnNumber : 0;
    return !!(card?.frozenUntilTurn && card.frozenUntilTurn >= currentTurn);
  },

  // Condição para saber se a unidade pode receber buffs
  canReceiveBuff(card) {
    return !this.isFrozen(card); // Usa o 'this.' interno correto do objeto
  },

  // Varre o tabuleiro procurando a primeira unidade ferida (vida/defesa atual menor que a base)
  chooseFirstDamagedUnit() {
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    for (const zone of zones) {
      const unit = (window.board?.[zone] || []).find(u => {
        if (!u?.card) return false;
        
        // Obtém a carta base do banco de dados (CARD_DB) para saber os atributos originais
        const base = window.CARD_DB?.[u.card.id];
        
        // Descobre qual o atributo de resistência usado (defense ou health)
        const baseDef = base?.defense ?? base?.health ?? u.card.defense;
        const currentDef = u.card.defense ?? u.card.health;

        // Se a resistência atual for menor que a original de fábrica, ela está danificada
        return currentDef < baseDef;
      });

      if (unit) return unit;
    }

    return null;
  }
};
// ======================================================
// EFEITOS BÁSICOS (REVISADO E BLINDADO)
// ======================================================
const EFFECT_BASICS = {
  // Auxiliar interno para extrair o card com segurança, não importa como o ctx venha
  _getCard(ctx) {
    if (!ctx) return null;
    if (ctx.card) return ctx.card;
    if (ctx.unit?.card) return ctx.unit.card;
    return typeof ctx.id === 'string' && (ctx.attack !== undefined || ctx.health !== undefined) ? ctx : null;
  },

  blitz(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.blitz = true;
    // Se o seu motor usar estados de ação, garante que já pode atacar
    if (ctx.state) {
      ctx.state.canAttack = true;
      ctx.state.summonTurn = false;
    }
  },

  berserk(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.berserk = true;
  },

  ranged(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.ranged = true;
  },

  smokescreen(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.smokescreen = true;
  },

  ignoreClassAdvantage(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.ignoreClassAdvantage = true;
  },

  heavyArmor(ctx, effect) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.heavyArmor = Number(effect?.args?.amount ?? 1);
  },

  mobilize(ctx, effect) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.mobilize = Number(effect?.args?.amount ?? 2);
  },

  pinStrike(ctx, effect) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.pinTurns = Number(effect?.args?.turns ?? 1);
  },

  riposte(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.riposte = true;
  },

  ambush(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.ambush = true;
  },

  firstHitShield(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.firstHitShield = true;
  },

  effectImmunity(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.effectImmune = true;
  },

  immuneToConquerorInsignia(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.immuneToConquerorInsignia = true;
  },

  chaosEnvoyImmunity(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    // Garante uma nova array para evitar problemas de referência de memória compartilhada
    card.immuneFromTypes = ["Pusher", "Equalizer"];
  },

  unitDamageImmunity(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.immuneToUnitDamage = true;
  },

  bonusVsPusher(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.bonusVsPusher = true;
  },

  grantAmbush(ctx) {
    const card = this._getCard(ctx);
    if (!card) return;
    card.ambush = true;
    
    const cardName = card.name || "Unidade";
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🐟 ${cardName} está escondido nas sombras!`);
    } else if (typeof window.showWarning === "function") {
      window.showWarning(`🐟 ${cardName} está escondido nas sombras!`);
    } else {
      console.log(`[Ambush]: ${cardName} está escondido nas sombras!`);
    }
  }
};
// ======================================================
// EFEITOS DE UNIDADES (REVISADO E BLINDADO)
// ======================================================
const EFFECT_UNITS = {
  lockEnemyActiveNoRetreat() {
    if (!window.board) return;
    const enemyActive =
      window.board.campo2?.find(unit => unit && unit.owner !== "player") ||
      window.board.bancoEnemy?.find(unit => unit && unit.owner !== "player");

    if (!enemyActive?.card) return;
    enemyActive.card.noRetreat = true;
  },

  scaleDefenseFromPlayerLife(ctx) {
    if (!ctx || !ctx.card) return;
    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const life = typeof window.playerLife === "number" ? window.playerLife : 0;
    const bonus = Math.floor(life / 2) * 1000;

    ctx.card.defense = (Number(ctx.card.defense) || 0) + bonus;
  },

  copyLastPlayedStats(ctx) {
    if (!ctx || !ctx.card) return;

    const last = window.__lastPlayedCard;
    if (!last || last.cardClass === "effect") return;
    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    if (typeof last.attack === "number") ctx.card.attack = last.attack;
    if (typeof last.defense === "number") ctx.card.defense = last.defense;
  },

  gainAttackOnKill(ctx, effect) {
    if (!ctx || !ctx.card) return;
    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const amount = Number(effect?.args?.amount ?? 1000);
    ctx.card.attack = (Number(ctx.card.attack) || 0) + amount;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🔥 ${ctx.card.name || 'Unidade'} ganhou +${amount} de ATK!`);
    }
  },

  paralyzeAttacker(ctx) {
    if (!ctx) return;
    const attacker = ctx.attacker;
    if (!attacker?.card) return;

    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    attacker.card.pinnedUntilTurn = currentTurn + 1;
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🦔 ${attacker.card.name || 'Atacante'} ficou paralisado!`);
    }
  },

  terrorcrocHeal(ctx, effect) {
    if (!ctx || !ctx.card) return;
    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const heal = Number(effect?.args?.amount ?? 200);
    ctx.card.defense = (Number(ctx.card.defense) || 0) + heal;
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🐊 ${ctx.card.name || 'Unidade'} recuperou ${heal} DEF!`);
    }
  },

  bastionGrowth(ctx, effect) {
    if (!ctx || !ctx.card) return;
    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const amount = Number(effect?.args?.amount ?? 200);
    ctx.card.attack = (Number(ctx.card.attack) || 0) + amount;
    ctx.card.defense = (Number(ctx.card.defense) || 0) + amount;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🛡️ ${ctx.card.name || 'Unidade'} ganhou +${amount} ATK / +${amount} DEF`);
    }
  },

  mimicGainSmokescreen(ctx) {
    if (!ctx || !ctx.card) return;
    ctx.card.smokescreen = true;
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🎭 ${ctx.card.name || 'Unidade'} ganhou Smokescreen!`);
    }
  },

  delaySelfAction(ctx, effect) {
    if (!ctx || !ctx.card) return;

    const turns = Number(effect?.args?.turns ?? 2);
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    ctx.card.sleepUntilTurn = currentTurn + turns;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🗿 ${ctx.card.name || 'Unidade'} só poderá agir em ${turns} turnos.`);
    }
  },

  gainBlitzIfEnemyDamaged(ctx) {
    if (!ctx || !ctx.card) return;

    const enemyZones = ["bancoEnemy", "campo2"];
    let hasDamagedEnemy = false;

    enemyZones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card || unit.owner === "player") return;

        const baseCard = window.CARD_DB?.[unit.card.id];
        const baseDefense = Number(baseCard?.defense ?? baseCard?.health ?? unit.card.defense || 0);
        const currentDefense = Number(unit.card.defense || 0);

        if (currentDefense < baseDefense) {
          hasDamagedEnemy = true;
        }
      });
    });

    if (hasDamagedEnemy) {
      ctx.card.blitz = true;
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn(`🦈 ${ctx.card.name || 'Unidade'} ganhou Blitz!`);
      }
    }
  },

  mobileFortressAura(ctx) {
    if (!ctx || !ctx.card) return;
    ctx.card.mobileFortress = true;
  },

  resetSelfToBase(ctx) {
    if (!ctx || !ctx.card) return;

    const base = window.CARD_DB?.[ctx.card.id];
    if (!base) return;

    ctx.card.attack = base.attack ?? ctx.card.attack;
    ctx.card.defense = base.defense ?? ctx.card.defense;

    ctx.card.tempBuffs = [];
    ctx.card.tempFlags = [];

    ctx.card.smokescreen = false;
    ctx.card.berserk = false;
    ctx.card.ranged = false;
    ctx.card.ignoreClassAdvantage = false;
    ctx.card.heavyArmor = 0;
    ctx.card.mobilize = 0;
    ctx.card.pinTurns = 0;
    ctx.card.riposte = false;
    ctx.card.ambush = false;
    ctx.card.blitz = true;

    if (base.effects && typeof window.runEffects === "function") {
      base.effects.forEach(effect => {
        if (!effect || effect.trigger !== "onSummon") return;
        if (effect.id === "blitz") return;

        const fn = window.EFFECTS?.[effect.id];
        if (typeof fn === "function") {
          fn({ ...ctx, card: ctx.card }, effect);
        }
      });
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🧪 ${ctx.card.name || 'Unidade'} voltou ao estado original!`);
    }
  }
};

// ======================================================
// DANO / CURA (REVISADO E BLINDADO)
// ======================================================
const EFFECT_DAMAGE = {
  damageActiveEnemy(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 0);

    const target =
      ctx && typeof ctx.getEnemyActiveCard === "function"
        ? ctx.getEnemyActiveCard()
        : (typeof EFFECT_UTILS?.getEnemyActive === "function" ? EFFECT_UTILS.getEnemyActive() : null);

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há unidade inimiga ativa.");
      return;
    }

    target.card.defense = Math.max(0, (Number(target.card.defense) || 0) - amount);
    if (typeof EFFECT_UTILS?.cleanup === "function") EFFECT_UTILS.cleanup(ctx);
  },

  dealDamageToEnemy(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 0);

    const target =
      ctx && typeof ctx.getEnemyTarget === "function"
        ? ctx.getEnemyTarget()
        : window.board ? (
            window.board.campo2?.find(u => u && u.owner !== "player") ||
            window.board.bancoEnemy?.find(u => u && u.owner !== "player")
          ) : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há alvo inimigo.");
      return;
    }

    target.card.defense = Math.max(0, (Number(target.card.defense) || 0) - amount);
    if (typeof EFFECT_UTILS?.cleanup === "function") EFFECT_UTILS.cleanup(ctx);
  },

  blackLuna(ctx) {
    const target =
      ctx && typeof ctx.getEnemyTarget === "function"
        ? ctx.getEnemyTarget()
        : window.board ? (
            window.board.campo2?.find(u => u && u.owner !== "player") ||
            window.board.bancoEnemy?.find(u => u && u.owner !== "player")
          ) : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há alvo inimigo.");
      return;
    }

    target.card.defense = 0;
    if (typeof EFFECT_UTILS?.cleanup === "function") EFFECT_UTILS.cleanup(ctx);
  },

  healActiveAlly(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 0);
    const target = typeof EFFECT_UTILS?.getPlayerActive === "function" ? EFFECT_UTILS.getPlayerActive() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem unidade para curar.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense = (Number(target.card.defense) || 0) + amount;
  },

  buffAttackActiveAlly(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 0);
    const duration = Number(effect?.args?.duration ?? 1);
    const target = typeof EFFECT_UTILS?.getPlayerActive === "function" ? EFFECT_UTILS.getPlayerActive() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem unidade para buffar.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack = (Number(target.card.attack) || 0) + amount;
    
    // Sintaxe retrocompatível segura substituindo o ||=
    if (!target.card.tempBuffs) {
      target.card.tempBuffs = [];
    }
    
    target.card.tempBuffs.push({
      stat: "attack",
      amount,
      turns: duration
    });
  },

  buffDefense400() {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem unidades em campo.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense = (Number(target.card.defense) || 0) + 400;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🛡 ${target.card.name || 'Unidade'} recebeu +400 DEF.`);
    }
  },

  massAttackBuff(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 100);
    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit || unit.owner !== "player" || !unit.card) return;
        if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(unit.card)) return;

        unit.card.attack = (Number(unit.card.attack) || 0) + amount;
        
        if (!unit.card.tempBuffs) unit.card.tempBuffs = [];
        unit.card.tempBuffs.push({
          stat: "attack",
          amount,
          turns: 1
        });

        if (!unit.card.tempFlags) unit.card.tempFlags = [];
        unit.card.blitz = true;
        unit.card.tempFlags.push({
          key: "blitz",
          turns: 1
        });
      });
    });
  },

  deathDamage300(ctx) {
    if (!ctx) return;
    const attacker = ctx.lastAttacker;
    if (!attacker?.card) return;

    attacker.card.defense = Math.max(0, (Number(attacker.card.defense) || 0) - 300);

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`👻 Casper causou 300 de dano ao atacante!`);
    }
  },

  revigoratingWind(ctx, effect) {
    const heal = Number(effect?.args?.amount ?? 1000);
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem unidade para curar.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense = (Number(target.card.defense) || 0) + heal;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🌬️ ${target.card.name || 'Unidade'} recuperou ${heal} DEF!`);
    }
  },

  meteorRain(ctx, effect) {
    const damage = Number(effect?.args?.damage ?? 100);
    const zones = ["campo1", "campo2", "bancoEnemy"];
    let hitCount = 0;

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card || unit.owner === "player") return;

        if (typeof window.applyDamageToCard === "function") {
          window.applyDamageToCard(unit.card, damage);
        } else {
          unit.card.defense = Math.max(0, (Number(unit.card.defense) || 0) - damage);
        }
        hitCount++;
      });
    });

    if (hitCount > 0 && typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`☄️ Chuva de Meteoros atingiu ${hitCount} unidades!`);
    }

    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  superNova(ctx, effect) {
    const damage = Number(effect?.args?.damage ?? 100);
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];
    let hit = 0;

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;

        if (typeof window.applyDamageToCard === "function") {
          window.applyDamageToCard(unit.card, damage);
        } else {
          unit.card.defense = Math.max(0, (Number(unit.card.defense) || 0) - damage);
        }
        hit++;
      });
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`💥 SuperNova atingiu ${hit} unidades!`);
    }
    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  warMachineSplash(ctx, effect) {
    if (!ctx || !ctx.card) return;

    const damage = Number(effect?.args?.damage ?? 500);
    const adjacentZones = ["campo1", "campo2"];

    adjacentZones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card || unit.owner === ctx.owner || unit.card === ctx.card) return;

        if (typeof window.applyDamageToCard === "function") {
          window.applyDamageToCard(unit.card, damage, ctx.card);
        } else {
          unit.card.defense = Math.max(0, (Number(unit.card.defense) || 0) - damage);
        }
      });
    });

    if (hitCount > 0 && typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🤖 ${ctx.card?.name || 'Unidade'} causou ${damage} de dano em tropas adjacentes!`);
    }
    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  poisonByEnemyHand(ctx, effect) {
    const damage = Number(effect?.args?.damage ?? 300);
    const enemyHandCount = window.enemyHand?.length ?? 0;

    if (enemyHandCount <= 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("☠️ O oponente não tem cartas na mão.");
      return;
    }

    const enemyUnits = [
      ...(window.board?.campo2 || []).filter(u => u && u.owner !== "player"),
      ...(window.board?.bancoEnemy || []).filter(u => u && u.owner !== "player")
    ];

    if (enemyUnits.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("☠️ Não há unidades inimigas em campo.");
      return;
    }

    const targetsToHit = Math.min(enemyHandCount, enemyUnits.length);

    for (let i = 0; i < targetsToHit; i++) {
      if (enemyUnits[i] && enemyUnits[i].card) {
        if (typeof window.applyDamageToCard === "function") {
          window.applyDamageToCard(enemyUnits[i].card, damage);
        } else {
          enemyUnits[i].card.defense = Math.max(0, (Number(enemyUnits[i].card.defense) || 0) - damage);
        }
      }
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`☠️ Envenenar causou ${damage} de dano em ${targetsToHit} unidade(s)!`);
    }
    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  rotTarget() {
    const target = typeof EFFECT_UTILS?.chooseFirstDamagedUnit === "function" ? EFFECT_UTILS.chooseFirstDamagedUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("☠️ Nenhuma unidade danificada.");
      return;
    }

    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    target.card.rotUntilTurn = currentTurn;
    target.card.__rotOriginalDefense = Number(target.card.defense || 0);
    target.card.defense = 0;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`☠️ ${target.card.name || 'Unidade'} está apodrecendo até o fim do turno!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  }
};

// ======================================================
// ENERGIA (REVISADO E BLINDADO)
// ======================================================
const EFFECT_ENERGY = {
  gainEnergyAura(ctx, effect) {
    if (!ctx || ctx.owner !== "player") return;

    const amount = Number(effect?.args?.amount ?? 1);
    const maxPE = typeof window.maxPE === "number" ? window.maxPE : 10;

    window.playerPE = (Number(window.playerPE) || 0) + amount;
    if (window.playerPE > maxPE) {
      window.playerPE = maxPE;
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⚡ Gyokuyo gerou +${amount} PE`);
    }
  },

  warIncentive() {
    window.__attackDiscountThisTurn = 2;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⚔ Suas unidades custam -2 PE para atacar neste turno!");
    }
  },

  superCharge(ctx, effect) {
    const amount = Number(effect?.args?.amount ?? 4);
    window.__bonusPENextTurn = (Number(window.__bonusPENextTurn) || 0) + amount;
  },

  stealSavedEnergy() {
    const saved = Number(window.__enemySavedPE || 0);
    const maxPE = typeof window.maxPE === "number" ? window.maxPE : 10;

    if (saved <= 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚡ O oponente não guardou PE.");
      return;
    }

    window.playerPE = (Number(window.playerPE) || 0) + saved;
    if (window.playerPE > maxPE) {
      window.playerPE = maxPE;
    }

    window.__enemySavedPE = 0;
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⚡ Recursos Emergentes roubou ${saved} PE!`);
    }
  },

  dirtyStrikeSacrifice() {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem unidade para sacrificar.");
      return;
    }

    const gainPE = Number(target.card.cost ?? 0);
    const maxPE = typeof window.maxPE === "number" ? window.maxPE : 10;
    target.card.defense = 0;

    window.playerPE = (Number(window.playerPE) || 0) + gainPE;
    if (window.playerPE > maxPE) {
      window.playerPE = maxPE;
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🩸 ${target.card.name || 'Unidade'} foi sacrificada! Você ganhou ${gainPE} PE.`);
    }

    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  thiefDrainEnergy(ctx) {
    if (!ctx || ctx.owner !== "player") return;

    if (typeof window.enemyPE === "number" && window.enemyPE > 0) {
      window.enemyPE = Math.max(0, window.enemyPE - 1);
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn("🗡️ Pequeno Ladrão roubou 1 PE do oponente!");
      }
    }
  }
};
// ======================================================
// CEMITÉRIO / COMPRA / BARALHO (REVISADO E BLINDADO)
// ======================================================
const EFFECT_GRAVEYARD = {
  reviveFromGrave() {
    if (!window.graveyardPlayer || window.graveyardPlayer.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Seu cemitério está vazio.");
      return;
    }

    if (!window.board || !window.board.bancoPlayer) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Estrutura do tabuleiro não inicializada.");
      return;
    }

    if (window.board.bancoPlayer.length >= 6) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
      return;
    }

    let reviveIndex = -1;
    for (let i = window.graveyardPlayer.length - 1; i >= 0; i--) {
      if (window.graveyardPlayer[i]?.cardClass === "unit") {
        reviveIndex = i;
        break;
      }
    }

    if (reviveIndex === -1) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há unidade para reviver.");
      return;
    }

    const targetData = window.graveyardPlayer.splice(reviveIndex, 1)[0];
    if (!targetData) return;

    const revivedCard = structuredClone(targetData);
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    revivedCard.defense = Math.max(1, Number(revivedCard.defense || 1));
    revivedCard.summonedTurn = currentTurn;
    revivedCard.actionTurn = currentTurn;
    if (!revivedCard.tempBuffs) revivedCard.tempBuffs = [];
    revivedCard.__lastOwner = "player";

    window.board.bancoPlayer.push({
      owner: "player",
      card: revivedCard
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`✨ ${revivedCard.name || 'Unidade'} voltou do cemitério!`);
    }
  },

  reaverRevive() {
    if (!window.board || !window.board.bancoPlayer) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Estrutura do tabuleiro não inicializada.");
      return;
    }

    if (window.board.bancoPlayer.length >= 6) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
      return;
    }

    if (!window.graveyardPlayer || window.graveyardPlayer.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há unidades no seu cemitério.");
      return;
    }

    // Localiza diretamente o índice real no array original para evitar erros de ponteiro ou duplicação
    const index = window.graveyardPlayer.findIndex(card => card && card.cardClass === "unit");

    if (index === -1) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há unidades no seu cemitério.");
      return;
    }

    const targetData = window.graveyardPlayer.splice(index, 1)[0];
    if (!targetData) return;

    const revivedCard = structuredClone(targetData);
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    revivedCard.summonedTurn = currentTurn;
    revivedCard.actionTurn = currentTurn;
    revivedCard.__lastOwner = "player";

    const unit = {
      owner: "player",
      card: revivedCard
    };

    window.board.bancoPlayer.push(unit);

    if (typeof window.runEffects === "function") {
      window.runEffects(revivedCard, "onSummon", {
        card: revivedCard,
        owner: "player",
        board: window.board,
        cleanupDead: window.cleanupDeadUnits
      });
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`☠️ ${revivedCard.name || 'Unidade'} voltou do cemitério!`);
    }
    
    if (typeof window.syncGlobals === "function") window.syncGlobals();
    if (typeof window.renderAll === "function") window.renderAll();
  }
};

  singularityShuffleGraves(ctx, effect) 
    const amount = Number(effect?.args?.amount ?? 10);

    if (!window.graveyardPlayer || !window.graveyardEnemy) return;
    if (!window.playerDeck || !window.enemyDeck) return;

    // Garante que não vai tentar dar splice em mais cartas do que o array possui
    const playerSpliceCount = Math.min(amount, window.graveyardPlayer.length);
    const enemySpliceCount = Math.min(amount, window.graveyardEnemy.length);

    const playerCards = window.graveyardPlayer.splice(0, playerSpliceCount);
    const enemyCards = window.graveyardEnemy.splice(0, enemySpliceCount);

    playerCards.forEach(card => {
      if (!card) return;
      const cloned = structuredClone(card);
      cloned.tempBuffs = [];
      cloned.summonedTurn = null;
      cloned.actionTurn = null;
      window.playerDeck.push(cloned);
    });

    enemyCards.forEach(card => {
      if (!card) return;
      const cloned = structuredClone(card);
      cloned.tempBuffs = [];
      cloned.summonedTurn = null;
      cloned.actionTurn = null;
      window.enemyDeck.push(cloned);
    });

    window.playerDeck.sort(() => Math.random() - 0.5);
    window.enemyDeck.sort(() => Math.random() - 0.5);

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🌀 Cartas dos cemitérios foram embaralhadas nos baralhos.");
    }
  

  oneirosPortal() 
    if (!window.playerDeck || window.playerDeck.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Seu baralho está vazio.");
      return;
    }

    const topCard = window.playerDeck[window.playerDeck.length - 1];
    if (!topCard) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não foi possível ver a carta do topo.");
      return;
    }

    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    if (topCard.cardClass === "unit") {
      if (!window.playerHand) window.playerHand = [];
      
      if (window.playerHand.length >= 10) {
        const discarded = window.playerDeck.pop();
        if (!discarded) return;

        if (!window.graveHistory) window.graveHistory = [];
        window.graveHistory.unshift({
          card: structuredClone(discarded),
          turn: currentTurn,
          owner: "player"
        });

        if (!window.graveyardPlayer) window.graveyardPlayer = [];
        window.graveyardPlayer.push(structuredClone(discarded));
        
        if (typeof EFFECT_UTILS?.warn === "function") {
          EFFECT_UTILS.warn(`🌀 ${discarded.name || 'Unidade'} era unidade, mas sua mão estava cheia e ela foi descartada.`);
        }
        return;
      }

      const drawn = window.playerDeck.pop();
      if (drawn) {
        window.playerHand.push(drawn);
        if (typeof EFFECT_UTILS?.warn === "function") {
          EFFECT_UTILS.warn(`🌀 Você revelou ${drawn.name || 'Unidade'} e colocou na mão!`);
        }
      }
      return;
    }

    const discarded = window.playerDeck.pop();
    if (!discarded) return;

    if (!window.graveHistory) window.graveHistory = [];
    window.graveHistory.unshift({
      card: structuredClone(discarded),
      turn: currentTurn,
      owner: "player"
    });

    if (!window.graveyardPlayer) window.graveyardPlayer = [];
    window.graveyardPlayer.push(structuredClone(discarded));
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🌀 Você revelou ${discarded.name || 'Carta'}. Como não era unidade, foi descartada.`);
    }
  

  contrabandoDraw() 
    if (typeof window.drawCardPlayer === "function") window.drawCardPlayer();
    if (typeof window.drawCardPlayer === "function") window.drawCardPlayer();
    
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("📦 Contrabando comprou 2 cartas!");
    }
  

  northernConvoy() 
    if (!window.playerDeck || window.playerDeck.length < 3) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Deck não tem cartas suficientes.");
      return;
    }

    const drawn = [
      window.playerDeck.pop(),
      window.playerDeck.pop(),
      window.playerDeck.pop()
    ];

    const names = drawn.map((c, i) => c ? `${i + 1}: ${c.name || 'Sem Nome'}` : `${i + 1}: Desconhecido`).join("\n");
    const promptInput = prompt(`Escolha uma carta:\n${names}`);
    const choice = parseInt(promptInput, 10);

    // Proteção estrita caso o usuário digite algo inválido ou cancele o prompt
    if (isNaN(choice) || choice < 1 || choice > 3) {
      // Devolve ao deck na ordem original
      for (let i = drawn.length - 1; i >= 0; i--) {
        if (drawn[i]) window.playerDeck.push(drawn[i]);
      }
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("Escolha inválida. Cartas devolvidas ao topo.");
      return;
    }

    const chosen = drawn[choice - 1];
    if (!chosen) return;

    if (!window.playerHand) window.playerHand = [];
    if (!window.graveyardPlayer) window.graveyardPlayer = [];

    if (window.playerHand.length < 10) {
      window.playerHand.push(chosen);
    } else {
      window.graveyardPlayer.push(structuredClone(chosen));
    }

    drawn.forEach((card, i) => {
      if (card && i !== choice - 1) {
        window.graveyardPlayer.push(card);
      }
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🚂 ${chosen.name || 'Unidade'} foi adicionada à sua mão.`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  

  returnAllEnemyUnitsToHand() 
    if (!window.board) return;
    const zones = ["bancoEnemy", "campo1", "campo2"];
    const returnedCards = [];
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    zones.forEach(zone => {
      const remaining = [];

      (window.board[zone] || []).forEach(unit => {
        if (unit && unit.owner !== "player" && unit.card) {
          returnedCards.push(structuredClone(unit.card));
        } else if (unit) {
          remaining.push(unit);
        }
      });

      window.board[zone] = remaining;
    });

    if (!window.enemyHand) window.enemyHand = [];
    if (!window.graveyardEnemy) window.graveyardEnemy = [];

    returnedCards.forEach(card => {
      if (!card) return;
      if (window.enemyHand.length < 10) {
        window.enemyHand.push(card);
      } else {
        if (!window.graveHistory) window.graveHistory = [];
        window.graveHistory.unshift({
          card: structuredClone(card),
          turn: currentTurn,
          owner: "enemy"
        });

        window.graveyardEnemy.push(structuredClone(card));
      }
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("👑 Todas as unidades inimigas em campo retornaram para a mão.");
    }
  


// ======================================================
// CONTRAMEDIDAS / CONTROLE (REVISADO E BLINDADO)
// ======================================================
const EFFECT_COUNTERS = {
  mirrorCounter() {
    window.__mirrorCounterActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🪞 Espelho ativado! O próximo efeito inimigo será refletido.");
    }
  },

  necronomiconCounter() {
    window.__stealNextEnemySummon = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("📕 Necronomicon ativado! A próxima unidade inimiga será sua.");
    }
  },

  logisticsCutCounter(ctx, effect) {
    window.__logisticsCutActive = true;
    window.__logisticsCutCost = Number(effect?.args?.maxCost ?? 5);
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("✂️ Corta Logística ativado!");
    }
  },

  divideAndConquerCounter(ctx) {
    window.__divideAndConquerActive = true;
    window.__divideAndConquerOwner = ctx?.owner || "player";
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⚔️ Dividir e Conquistar ativado!");
    }
  },

  lokiGripCounter() {
    window.__lokiGripActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🐍 O Aperto de Lóki foi preparado!");
    }
  },

  terminusCounter() {
    window.__terminusActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("☠️ Terminus foi preparado!");
    }
  },

  incinerarTrap() {
    window.__incinerarTrapActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🔥 Incinerar preparado!");
    }
  },

  clusterAntimateria() {
    window.__clusterCounterActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("💠 Cluster Antimatéria preparado!");
    }
  },

  illegalDiversionCounter() {
    window.__illegalDiversionActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🕵️ Desvio Ilegal preparado!");
    }
  },

  blefarCounter() {
    window.__blefarActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🎭 Blefar foi preparado!");
    }
  },

  armedNetCounter() {
    window.__armedNetActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🕸️ Rede Armada preparada!");
    }
  },

  quickCounterAttack() {
    if (!window.__playerWasAttackedLastTurn) {
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn("⚠ Nenhum ataque recebido no último turno.");
      }
      return;
    }

    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card || unit.owner !== "player") return;

        // Subvenção segura substituindo o ||=
        if (!unit.card.tempFlags) {
          unit.card.tempFlags = [];
        }
        
        unit.card.blitz = true;
        unit.card.tempFlags.push({
          key: "blitz",
          turns: 1
        });
      });
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⚡ Contra-ataque ativado!");
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  quickResponseTrap() {
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    window.__quickResponseTrapActive = true;
    window.__quickResponseTrapTurn = currentTurn + 1;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⚡ Resposta Rápida preparada!");
    }
  },

  delayCounter() {
    window.__delayCounterActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⏳ Atrasar ativado.");
    }
  },

  interceptCounter() {
    window.__interceptCounterActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🛡️ Interceptar ativado.");
    }
  },

  panicCounter() {
    window.__panicCounterActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("😱 Pânico ativado.");
    }
  }
};
// ======================================================
// TEMPORAL / CAMPO / ESPECIAIS (REVISADO E BLINDADO)
// ======================================================
const EFFECT_TEMPORAL = {
  infiniteVoid(ctx, effect) {
    const turns = Number(effect?.args?.turns ?? 2);
    const zones = ["campo1", "campo2", "bancoEnemy"];
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    zones.forEach(zone => {
      const units = window.board?.[zone] || [];
      units.forEach(unit => {
        if (unit && unit.owner !== "player" && unit.card) {
          unit.card.pinnedUntilTurn = currentTurn + turns;
        }
      });
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🕳️ Vazio Imensurável paralisou o inimigo por ${turns} turnos!`);
    }
  },

  malevolentShrine(ctx, effect) {
    window.__malevolentTurns = Number(effect?.args?.turns ?? 6);
    window.__malevolentDamage = Number(effect?.args?.damage ?? 300);
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🩸 Santuário Malevolente foi ativado!");
    }
  },

  endlessWinter(ctx, effect) {
    const turns = Number(effect?.args?.turns ?? 2);
    window.__endlessWinterTurns = turns;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`❄️ Inverno Duradouro congelou o campo por ${turns} turnos!`);
    }
  },

  banimentoDaLuz() {
    window.__lightBanActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("☀️ Suas unidades aplicam Pin neste turno!");
    }
  },

  astrumFieldLock() {
    window.__astrumFieldLockActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🌌 Astrum bloqueou todos os efeitos!");
    }
  },

  astrumFieldUnlock() {
    window.__astrumFieldLockActive = false;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🌌 O bloqueio de Astrum acabou.");
    }
  },

  eternumLockField() {
    window.__eternumLockActive = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⛓️ Eternum bloqueou o campo! Nenhuma unidade pode ser invocada.");
    }
  },

  eternumUnlockField() {
    window.__eternumLockActive = false;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⛓️ O bloqueio de Eternum acabou.");
    }
  },

  swapFields() {
    const board = window.board;
    if (!board) return;

    // Blindagem de arrays estruturais antes do spread operator
    const tempCampo1 = [...(board.campo1 || [])];
    const tempCampo2 = [...(board.campo2 || [])];

    board.campo1 = tempCampo2;
    board.campo2 = tempCampo1;

    board.campo1.forEach(unit => {
      if (!unit) return;
      unit.owner = "player";
      if (unit.card) unit.card.__lastOwner = "player";
    });

    board.campo2.forEach(unit => {
      if (!unit) return;
      unit.owner = "enemy";
      if (unit.card) unit.card.__lastOwner = "enemy";
    });

    if (typeof window.updateEudoriaPrince === "function") window.updateEudoriaPrince();
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🕳️ Horizonte de Eventos trocou o controle entre Campo 1 e Campo 2!");
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  temporalReset() {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⏳ Nenhuma unidade sua para afetar.");
      return;
    }

    const base = window.CARD_DB?.[target.card.id];
    if (!base) return;

    target.card.attack = base.attack ?? target.card.attack;
    target.card.defense = base.defense ?? target.card.defense;
    target.card.tempBuffs = [];
    target.card.tempFlags = [];
    target.card.smokescreen = true;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⏳ ${target.card.name || 'Unidade'} voltou ao estado original!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  rewindCard() {
    if (!window.board) return;
    const zones = ["bancoPlayer", "campo1", "campo2"];
    let targetZone = null;
    let targetIndex = -1;

    for (const zone of zones) {
      const index = (window.board[zone] || []).findIndex(u => u && u.owner === "player");
      if (index !== -1) {
        targetZone = zone;
        targetIndex = index;
        break;
      }
    }

    if (targetZone === null || targetIndex === -1) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⏳ Nenhuma carta sua em campo.");
      return;
    }

    if (!window.playerHand) window.playerHand = [];
    if (window.playerHand.length >= 10) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Sua mão está cheia!");
      return;
    }

    const unit = window.board[targetZone][targetIndex];
    if (!unit || !unit.card) return;

    if (typeof window.createCardFromId !== "function") return;
    const freshCard = window.createCardFromId(unit.card.id);
    if (!freshCard) return;

    // Só remove de campo após confirmar que a carta nova foi gerada com sucesso
    window.board[targetZone].splice(targetIndex, 1);
    window.playerHand.push(freshCard);

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⏳ ${unit.card.name || 'Unidade'} voltou para sua mão!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  temporalPulse() {
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    const lastTurn = currentTurn - 1;

    const valid = (window.graveHistory || []).filter(entry =>
      entry &&
      entry.owner === "player" &&
      entry.turn === lastTurn &&
      entry.card &&
      entry.card.cardClass === "unit"
    );

    if (valid.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⏳ Nenhuma unidade do último turno.");
      return;
    }

    if (!window.board || !window.board.bancoPlayer) window.board = { bancoPlayer: [], ...window.board };
    if (window.board.bancoPlayer.length >= 6) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Banco cheio.");
      return;
    }

    const chosen = valid[0].card;
    if (!chosen || typeof window.createCardFromId !== "function") return;

    const revived = window.createCardFromId(chosen.id);
    if (!revived) return;

    window.board.bancoPlayer.push({
      owner: "player",
      card: revived
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⏳ ${revived.name || 'Unidade'} retornou pelo Pulso Temporal!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  timeJump() {
    window.__skipPENextTurnGain = true;
    window.__bonusPENextTurn = (Number(window.__bonusPENextTurn) || 0) + 2;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("⏳ Salto Temporal ativado!");
    }
  },

  freezeUnit(ctx, effect) {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("❄️ Nenhuma unidade para congelar.");
      return;
    }

    const turns = Number(effect?.args?.turns ?? 2);
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    target.card.frozenUntilTurn = currentTurn + turns;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`❄️ ${target.card.name || 'Unidade'} foi congelada por ${turns} turnos!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  }
};

// ======================================================
// ESPECIAIS / CARTAS ÚNICAS (REVISADO E BLINDADO)
// ======================================================
const EFFECT_SPECIAL_PART2 = {
  voidServantsBlitz(ctx) {
    if (!ctx) return;
    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit && unit.owner === ctx.owner && unit.card && Array.isArray(unit.card.tags) && unit.card.tags.includes("void")) {
          unit.card.blitz = true;
        }
      });
    });
  },

  aurumShuffleHand(ctx) {
    if (!ctx || ctx.owner !== "player") return;
    if (!window.playerHand || window.playerHand.length === 0) return;
    if (!window.playerDeck) window.playerDeck = [];

    const amount = window.playerHand.length;
    let safetyGuard = 0;

    // Move cartas da mão para o deck limpando flags temporárias
    while (window.playerHand.length > 0 && safetyGuard < amount) {
      safetyGuard++;
      const card = window.playerHand.pop();
      if (!card) continue;

      card.summonedTurn = null;
      card.actionTurn = null;
      card.tempBuffs = [];
      card.tempFlags = [];

      window.playerDeck.push(card);
    }

    // Embaralhamento seguro
    window.playerDeck.sort(() => Math.random() - 0.5);

    // Compra novamente as cartas até o limite original ou limite máximo de mão (10)
    for (let i = 0; i < amount; i++) {
      if (window.playerDeck.length === 0) break;
      if (window.playerHand.length >= 10) break;

      const drawn = window.playerDeck.pop();
      if (drawn) window.playerHand.push(drawn);
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🌟 Aurum embaralhou sua mão e comprou ${Math.min(amount, 10)} carta(s)!`);
    }
  },

  sideralInfection(ctx, effect) {
    const damage = Number(effect?.args?.damage ?? 500);
    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;

    const target =
      (window.board?.campo2 || []).find(u => u && u.owner !== "player") ||
      (window.board?.bancoEnemy || []).find(u => u && u.owner !== "player");

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Não há unidade inimiga para infectar.");
      return;
    }

    target.card.sideralInfection = {
      damage,
      startedTurn: currentTurn,
      spreadReadyTurn: currentTurn + 1,
      spreadDone: false
    };

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🦠 ${target.card.name || 'Unidade'} foi infectada!`);
    }
  },

  vultureCheckInfectionKills() {
    if (!window.board) return;
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      (window.board[zone] || []).forEach(unit => {
        if (!unit || !unit.card) return;
        const infection = unit.card.sideralInfection;
        if (!infection) return;

        const defense = Number(unit.card.defense) || 0;
        if (defense <= 0 && !unit.card.__countedByVulture) {
          unit.card.__countedByVulture = true;

          const vultures = typeof EFFECT_UTILS?.getPlayerUnits === "function" 
            ? EFFECT_UTILS.getPlayerUnits().filter(u => u && u.card && u.card.id === "J013")
            : [];

          vultures.forEach(v => {
            if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(v.card)) return;

            v.card.attack = (Number(v.card.attack) || 0) + 400;
            v.card.defense = (Number(v.card.defense) || 0) + 400;
            
            if (typeof EFFECT_UTILS?.warn === "function") {
              EFFECT_UTILS.warn(`🦅 Abutre Cósmico ficou mais forte!`);
            }
          });
        }
      });
    });
  },

  wormholeSummon() {
    if (!window.playerHand || window.playerHand.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Você não tem cartas na mão.");
      return;
    }

    if (!window.board) window.board = {};
    if (!window.board.bancoPlayer) window.board.bancoPlayer = [];

    if (window.board.bancoPlayer.length >= 6) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
      return;
    }

    const index = window.playerHand.findIndex(c => c && c.cardClass === "unit");

    if (index === -1) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade na mão.");
      return;
    }

    const card = window.playerHand.splice(index, 1)[0];
    if (!card) return;

    const currentTurn = typeof window.turnNumber === "number" ? window.turnNumber : 0;
    card.summonedTurn = currentTurn;
    card.actionTurn = currentTurn;
    card.__lastOwner = "player";
    card.summonedByWormhole = true;

    const unit = {
      owner: "player",
      card
    };

    window.board.bancoPlayer.push(unit);

    if (typeof window.runEffects === "function") {
      window.runEffects(card, "onSummon", {
        card,
        owner: "player",
        board: window.board,
        cleanupDead: window.cleanupDeadUnits
      });
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🌀 ${card.name || 'Unidade'} entrou em campo através do Buraco de Minhoca!`);
    }

    if (typeof window.syncGlobals === "function") window.syncGlobals();
    if (typeof window.renderAll === "function") window.renderAll();
  },

  xmAresWormholeBuff(ctx) {
    if (!ctx || !ctx.card) return;

    if (ctx.card.summonedByWormhole) {
      ctx.card.attackCost = 0;
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn("🤖 XM-Ares foi invocado por Buraco de Minhoca e ficou com ATK 0 neste turno!");
      }
    }
  },

  conquerorInsignia() {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade para receber a Insígnia.");
      return;
    }

    if (target.card.immuneToConquerorInsignia) {
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn(`🛡 ${target.card.name || 'Unidade'} não pode receber a Insígnia do Conquistador!`);
      }
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack = (Number(target.card.attack) || 0) + 800;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🏅 ${target.card.name || 'Unidade'} recebeu +800 ATK!`);
    }
  },

  eudoriaPrinceInit(ctx) {
    if (!ctx || !ctx.card) return;
    ctx.card.baseAttackEudoria = ctx.card.attack;
    if (typeof window.updateEudoriaPrince === "function") window.updateEudoriaPrince();
  },

  terraBladeEquip() {
    if (!window.board) return;
    const target =
      (window.board.campo2 || []).find(u => u && u.card && u.card.id === "J015") ||
      (window.board.campo1 || []).find(u => u && u.card && u.card.id === "J015") ||
      (window.board.bancoPlayer || []).find(u => u && u.card && u.card.id === "J015");

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") {
        EFFECT_UTILS.warn("⚠ Terra-Blade só pode ser usada no Herói Sem Nome.");
      }
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack = (Number(target.card.attack) || 0) + 2000;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🗡️ Terra-Blade fortaleceu ${target.card.name || 'Herói'}! +2000 ATK`);
    }
  },

  strategistPeekTopDeck(ctx) {
    if (!ctx || !ctx.card || ctx.owner !== "player") return;
    if (!window.playerDeck || window.playerDeck.length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("🧠 Seu baralho está vazio.");
      return;
    }

    const topCard = window.playerDeck[window.playerDeck.length - 1];
    if (!topCard) return;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🧠 Topo do deck: ${topCard.name || 'Carta Oculta'}`);
    }
  },

  dandelionEffect(ctx) {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade aliada.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.effectImmune = true;
    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🌼 ${target.card.name || 'Unidade'} agora está imune a efeitos!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  armorPierceBuff(ctx, effect) {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade para buffar.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    const amount = Number(effect?.args?.amount ?? 1);
    target.card.armorPierce = (Number(target.card.armorPierce) || 0) + amount;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🗡️ ${target.card.name || 'Unidade'} agora ignora ${amount} nível de Armadura Pesada!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  gungnirBuff() {
    const target = typeof EFFECT_UTILS?.getFirstPlayerUnit === "function" ? EFFECT_UTILS.getFirstPlayerUnit() : null;

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade para receber Gungnir.");
      return;
    }

    if (typeof EFFECT_UTILS?.canReceiveBuff === "function" && !EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.ignoreHeavyArmor = true;

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`⚔️ ${target.card.name || 'Unidade'} agora ignora Armadura Pesada!`);
    }
    if (typeof window.renderAll === "function") window.renderAll();
  },

  devourAllUnits(ctx) {
    if (!ctx) return;
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      const units = [...(window.board?.[zone] || [])];
      units.forEach(unit => {
        if (unit?.card) unit.card.defense = 0;
      });
    });

    if (typeof EFFECT_UTILS?.cleanup === "function") EFFECT_UTILS.cleanup(ctx);

    if (ctx.owner === "player") {
      window.playerLife = (Number(window.playerLife) || 0) - 1;
    } else {
      window.enemyLife = (Number(window.enemyLife) || 0) - 1;
    }
  },

  reapStrike(ctx, effect) {
    if (!window.board) return;
    const damage = Number(effect?.args?.damage ?? 1000);
    const maxCost = Number(effect?.args?.maxCost ?? 7);

    const target =
      (window.board.campo2 || []).find(u => u && u.owner !== "player" && u.card && (Number(u.card.cost) || 0) <= maxCost) ||
      (window.board.bancoEnemy || []).find(u => u && u.owner !== "player" && u.card && (Number(u.card.cost) || 0) <= maxCost);

    if (!target?.card) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("⚠ Nenhuma unidade válida para Ceifar.");
      return;
    }

    if (typeof window.applyDamageToCard === "function") {
      window.applyDamageToCard(target.card, damage);
    } else {
      target.card.defense = Math.max(0, (Number(target.card.defense) || 0) - damage);
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🪓 Ceifar causou ${damage} de dano em ${target.card.name || 'Unidade'}!`);
    }
    if (typeof window.cleanupDeadUnits === "function") window.cleanupDeadUnits();
  },

  reduceEnemyActiveAttack(ctx, effect) {
    if (!ctx) return;
    const amount = Number(effect?.args?.amount ?? 300);

    ["campo1", "campo2"].forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit && unit.owner !== ctx.owner && unit.card) {
          unit.card.attack = (Number(unit.card.attack) || 0) - amount;
          
          if (!unit.card.tempBuffs) {
            unit.card.tempBuffs = [];
          }
          
          unit.card.tempBuffs.push({
            stat: "attack",
            amount: -amount,
            turns: 1
          });
        }
      });
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`💀 Unidades inimigas perderam ${amount} de ataque!`);
    }
  },

  halveEnemyStats(ctx) {
    if (!ctx) return;
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit && unit.owner !== ctx.owner && unit.card) {
          const currentAttack = Number(unit.card.attack) || 0;
          const currentDefense = Number(unit.card.defense) || 0;
          
          unit.card.attack = Math.max(0, Math.floor(currentAttack / 2));
          unit.card.defense = Math.max(0, Math.floor(currentDefense / 2));
        }
      });
    });

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("🔥 Terra Arrasada reduziu os atributos inimigos pela metade!");
    }
  }
};

 // ======================================================
// ÚLTIMOS EFEITOS E COMPOSIÇÃO GLOBAL (REVISADO E BLINDADO)
// ======================================================
const EFFECT_FINAL = {
  tyrannosaurusMobilize() {
    const board = window.board;
    if (!board) return;

    // Garante que o banco inimigo esteja estruturado
    if (!board.bancoEnemy) board.bancoEnemy = [];

    const enemyZones = ["campo1", "campo2"];
    const moved = [];

    enemyZones.forEach(zone => {
      const units = [...(board[zone] || [])];

      units.forEach(unit => {
        if (!unit || unit.owner !== "enemy") return;

        if (board.bancoEnemy.length < 6) {
          board[zone] = (board[zone] || []).filter(u => u !== unit);
          board.bancoEnemy.push(unit);
          moved.push(unit.card?.name || "Unidade Desconhecida");
        }
      });
    });

    if (moved.length > 0 && typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn(`🦖 Tiranossauro empurrou ${moved.length} unidades para o banco!`);
    }

    if (typeof window.renderAll === "function") window.renderAll();
  },

  necromancerRevive() {
    if ((window.graveyardPlayer || []).length === 0) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("💀 Não há cartas no cemitério.");
      return;
    }

    if (!window.board) window.board = {};
    if ((window.board.bancoPlayer || []).length >= 6) {
      if (typeof EFFECT_UTILS?.warn === "function") EFFECT_UTILS.warn("💀 Banco cheio!");
      return;
    }

    window.__necromancerReviveActive = true;

    if (typeof window.openGraveyard === "function") {
      window.openGraveyard(window.graveyardPlayer, "Escolha uma carta para reviver");
    }

    if (typeof EFFECT_UTILS?.warn === "function") {
      EFFECT_UTILS.warn("💀 Escolha uma carta do cemitério.");
    }
  }
};

// COMPOSIÇÃO COM SALVAGUARDA CONTRA OBJETOS UNDEFINED
window.EFFECTS = {
  ...(typeof EFFECT_UTILS !== "undefined" ? EFFECT_UTILS : {}),
  ...(typeof EFFECT_BASICS !== "undefined" ? EFFECT_BASICS : {}),
  ...(typeof EFFECT_UNITS !== "undefined" ? EFFECT_UNITS : {}),
  ...(typeof EFFECT_DAMAGE !== "undefined" ? EFFECT_DAMAGE : {}),
  ...(typeof EFFECT_ENERGY !== "undefined" ? EFFECT_ENERGY : {}),
  ...(typeof EFFECT_GRAVEYARD !== "undefined" ? EFFECT_GRAVEYARD : {}),
  ...(typeof EFFECT_COUNTERS !== "undefined" ? EFFECT_COUNTERS : {}),
  ...(typeof EFFECT_TEMPORAL !== "undefined" ? EFFECT_TEMPORAL : {}),
  ...(typeof EFFECT_SPECIAL !== "undefined" ? EFFECT_SPECIAL : {}),
  ...EFFECT_FINAL // Inclui as funções revisadas acima
};
