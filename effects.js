
// ======================================================
// UTILITÁRIOS
// ======================================================
const EFFECT_UTILS = {
  getPlayerUnits() {
    const zones = ["bancoPlayer", "campo1", "campo2"];
    const result = [];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit?.owner === "player" && unit?.card) {
          result.push(unit);
        }
      });
    });

    return result;
  },

  getEnemyUnits() {
    const zones = ["bancoEnemy", "campo2", "campo1"];
    const result = [];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit?.owner !== "player" && unit?.card) {
          result.push(unit);
        }
      });
    });

    return result;
  },

  getPlayerActive() {
    return (
      window.board?.campo2?.find(u => u.owner === "player") ||
      window.board?.campo1?.find(u => u.owner === "player") ||
      window.board?.bancoPlayer?.find(u => u.owner === "player") ||
      null
    );
  },

  getEnemyActive() {
    return (
      window.board?.campo2?.find(u => u.owner !== "player") ||
      window.board?.bancoEnemy?.find(u => u.owner !== "player") ||
      null
    );
  },

  getFirstPlayerUnit() {
    return (
      window.board?.campo2?.find(u => u.owner === "player") ||
      window.board?.campo1?.find(u => u.owner === "player") ||
      window.board?.bancoPlayer?.find(u => u.owner === "player") ||
      null
    );
  },

  getFirstEnemyUnit() {
    return (
      window.board?.campo2?.find(u => u.owner !== "player") ||
      window.board?.bancoEnemy?.find(u => u.owner !== "player") ||
      window.board?.campo1?.find(u => u.owner !== "player") ||
      null
    );
  },

  cleanup(ctx) {
    if (typeof ctx?.cleanupDead === "function") {
      ctx.cleanupDead();
      return;
    }

    if (typeof window.cleanupDeadUnits === "function") {
      window.cleanupDeadUnits();
    }
  },

  warn(text) {
    if (typeof window.showWarning === "function") {
      window.showWarning(text);
    }
  },

  isFrozen(card) {
    return !!(card?.frozenUntilTurn && card.frozenUntilTurn >= window.turnNumber);
  },

  canReceiveBuff(card) {
    return !EFFECT_UTILS.isFrozen(card);
  },

  chooseFirstDamagedUnit() {
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    for (const zone of zones) {
      const unit = (window.board?.[zone] || []).find(u => {
        if (!u?.card) return false;
        const base = window.CARD_DB?.[u.card.id];
        const baseDef = base?.defense ?? base?.health ?? u.card.defense;
        return u.card.defense < baseDef;
      });

      if (unit) return unit;
    }

    return null;
  }
};
// ======================================================
// EFEITOS BÁSICOS
// ======================================================
const EFFECT_BASICS = {
  blitz(ctx) {
    if (!ctx.card) return;
    ctx.card.blitz = true;
  },

  berserk(ctx) {
    if (!ctx.card) return;
    ctx.card.berserk = true;
  },

  ranged(ctx) {
    if (!ctx.card) return;
    ctx.card.ranged = true;
  },

  smokescreen(ctx) {
    if (!ctx.card) return;
    ctx.card.smokescreen = true;
  },

  ignoreClassAdvantage(ctx) {
    if (!ctx.card) return;
    ctx.card.ignoreClassAdvantage = true;
  },

  heavyArmor(ctx, effect) {
    if (!ctx.card) return;
    ctx.card.heavyArmor = effect?.args?.amount ?? 1;
  },

  mobilize(ctx, effect) {
    if (!ctx.card) return;
    ctx.card.mobilize = effect?.args?.amount ?? 2;
  },

  pinStrike(ctx, effect) {
    if (!ctx.card) return;
    ctx.card.pinTurns = effect?.args?.turns ?? 1;
  },

  riposte(ctx) {
    if (!ctx.card) return;
    ctx.card.riposte = true;
  },

  ambush(ctx) {
    if (!ctx.card) return;
    ctx.card.ambush = true;
  },

  firstHitShield(ctx) {
    if (!ctx.card) return;
    ctx.card.firstHitShield = true;
  },

  effectImmunity(ctx) {
    if (!ctx.card) return;
    ctx.card.effectImmune = true;
  },

  immuneToConquerorInsignia(ctx) {
    if (!ctx.card) return;
    ctx.card.immuneToConquerorInsignia = true;
  },

  chaosEnvoyImmunity(ctx) {
    if (!ctx.card) return;
    ctx.card.immuneFromTypes = ["Pusher", "Equalizer"];
  },

  unitDamageImmunity(ctx) {
    if (!ctx.card) return;
    ctx.card.immuneToUnitDamage = true;
  },

  bonusVsPusher(ctx) {
    if (!ctx.card) return;
    ctx.card.bonusVsPusher = true;
  },

  grantAmbush(ctx) {
    if (!ctx.card) return;
    ctx.card.ambush = true;
    EFFECT_UTILS.warn(`🐟 ${ctx.card.name} está escondido nas sombras!`);
  }
};
// ======================================================
// EFEITOS DE UNIDADES
// ======================================================
const EFFECT_UNITS = {
  lockEnemyActiveNoRetreat() {
    const enemyActive =
      window.board?.campo2?.find(unit => unit.owner !== "player") ||
      window.board?.bancoEnemy?.find(unit => unit.owner !== "player");

    if (!enemyActive?.card) return;
    enemyActive.card.noRetreat = true;
  },

  scaleDefenseFromPlayerLife(ctx) {
    if (!ctx.card) return;
    if (!EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const life = typeof window.playerLife === "number" ? window.playerLife : 0;
    const bonus = Math.floor(life / 2) * 1000;

    ctx.card.defense += bonus;
  },

  copyLastPlayedStats(ctx) {
    if (!ctx.card) return;

    const last = window.__lastPlayedCard;
    if (!last || last.cardClass === "effect") return;
    if (!EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    if (typeof last.attack === "number") ctx.card.attack = last.attack;
    if (typeof last.defense === "number") ctx.card.defense = last.defense;
  },

  gainAttackOnKill(ctx, effect) {
    if (!ctx.card) return;
    if (!EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    const amount = effect?.args?.amount ?? 1000;
    ctx.card.attack += amount;

    EFFECT_UTILS.warn(`🔥 ${ctx.card.name} ganhou +${amount} de ATK!`);
  },

  paralyzeAttacker(ctx) {
    const attacker = ctx.attacker;
    if (!attacker?.card) return;

    attacker.card.pinnedUntilTurn = window.turnNumber + 1;
    EFFECT_UTILS.warn(`🦔 ${attacker.card.name} ficou paralisado!`);
  },

  terrorcrocHeal(ctx, effect) {
    const heal = effect?.args?.amount ?? 200;
    if (!ctx.card) return;
    if (!EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    ctx.card.defense += heal;
    EFFECT_UTILS.warn(`🐊 ${ctx.card.name} recuperou ${heal} DEF!`);
  },

  bastionGrowth(ctx, effect) {
    const amount = effect?.args?.amount ?? 200;
    if (!ctx.card) return;
    if (!EFFECT_UTILS.canReceiveBuff(ctx.card)) return;

    ctx.card.attack += amount;
    ctx.card.defense += amount;

    EFFECT_UTILS.warn(`🛡️ ${ctx.card.name} ganhou +${amount} ATK / +${amount} DEF`);
  },

  mimicGainSmokescreen(ctx) {
    if (!ctx.card) return;
    ctx.card.smokescreen = true;
    EFFECT_UTILS.warn(`🎭 ${ctx.card.name} ganhou Smokescreen!`);
  },

  delaySelfAction(ctx, effect) {
    if (!ctx.card) return;

    const turns = effect?.args?.turns ?? 2;
    ctx.card.sleepUntilTurn = window.turnNumber + turns;

    EFFECT_UTILS.warn(`🗿 ${ctx.card.name} só poderá agir em ${turns} turnos.`);
  },

  gainBlitzIfEnemyDamaged(ctx) {
    if (!ctx.card) return;

    const enemyZones = ["bancoEnemy", "campo2"];
    let hasDamagedEnemy = false;

    enemyZones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;
        if (unit.owner === "player") return;

        const baseCard = window.CARD_DB?.[unit.card.id];
        const baseDefense = baseCard?.defense ?? baseCard?.health ?? unit.card.defense;

        if (unit.card.defense < baseDefense) {
          hasDamagedEnemy = true;
        }
      });
    });

    if (hasDamagedEnemy) {
      ctx.card.blitz = true;
      EFFECT_UTILS.warn(`🦈 ${ctx.card.name} ganhou Blitz!`);
    }
  },

  mobileFortressAura(ctx) {
    if (!ctx.card) return;
    ctx.card.mobileFortress = true;
  },

  resetSelfToBase(ctx) {
    if (!ctx.card) return;

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
        if (fn) {
          fn({ ...ctx, card: ctx.card }, effect);
        }
      });
    }

    EFFECT_UTILS.warn(`🧪 ${ctx.card.name} voltou ao estado original!`);
  }
};
// ======================================================
// DANO / CURA
// ======================================================
const EFFECT_DAMAGE = {
  damageActiveEnemy(ctx, effect) {
    const amount = effect?.args?.amount ?? 0;

    const target =
      typeof ctx.getEnemyActiveCard === "function"
        ? ctx.getEnemyActiveCard()
        : EFFECT_UTILS.getEnemyActive();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Não há unidade inimiga ativa.");
      return;
    }

    target.card.defense -= amount;
    EFFECT_UTILS.cleanup(ctx);
  },

  dealDamageToEnemy(ctx, effect) {
    const amount = effect?.args?.amount ?? 0;

    const target =
      typeof ctx.getEnemyTarget === "function"
        ? ctx.getEnemyTarget()
        : (
            window.board?.campo2?.find(u => u.owner !== "player") ||
            window.board?.bancoEnemy?.find(u => u.owner !== "player")
          );

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Não há alvo inimigo.");
      return;
    }

    target.card.defense -= amount;
    EFFECT_UTILS.cleanup(ctx);
  },

  blackLuna(ctx) {
    const target =
      typeof ctx.getEnemyTarget === "function"
        ? ctx.getEnemyTarget()
        : (
            window.board?.campo2?.find(u => u.owner !== "player") ||
            window.board?.bancoEnemy?.find(u => u.owner !== "player")
          );

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Não há alvo inimigo.");
      return;
    }

    target.card.defense = 0;
    EFFECT_UTILS.cleanup(ctx);
  },

  healActiveAlly(ctx, effect) {
    const amount = effect?.args?.amount ?? 0;
    const target = EFFECT_UTILS.getPlayerActive();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidade para curar.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense += amount;
  },

  buffAttackActiveAlly(ctx, effect) {
    const amount = effect?.args?.amount ?? 0;
    const duration = effect?.args?.duration ?? 1;
    const target = EFFECT_UTILS.getPlayerActive();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidade para buffar.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack += amount;
    target.card.tempBuffs ||= [];
    target.card.tempBuffs.push({
      stat: "attack",
      amount,
      turns: duration
    });
  },

  buffDefense400() {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidades em campo.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense += 400;
    EFFECT_UTILS.warn(`🛡 ${target.card.name} recebeu +400 DEF.`);
  },

  massAttackBuff(ctx, effect) {
    const amount = effect?.args?.amount ?? 100;
    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit.owner !== "player" || !unit.card) return;
        if (!EFFECT_UTILS.canReceiveBuff(unit.card)) return;

        unit.card.attack += amount;
        unit.card.tempBuffs ||= [];
        unit.card.tempBuffs.push({
          stat: "attack",
          amount,
          turns: 1
        });

        unit.card.tempFlags ||= [];
        unit.card.blitz = true;
        unit.card.tempFlags.push({
          key: "blitz",
          turns: 1
        });
      });
    });
  },

  deathDamage300(ctx) {
    const attacker = ctx.lastAttacker;
    if (!attacker?.card) return;

    attacker.card.defense -= 300;
    if (attacker.card.defense < 0) attacker.card.defense = 0;

    EFFECT_UTILS.warn(`👻 Casper causou 300 de dano ao atacante!`);
  },

  revigoratingWind(ctx, effect) {
    const heal = effect?.args?.amount ?? 1000;
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidade para curar.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.defense += heal;
    EFFECT_UTILS.warn(`🌬️ ${target.card.name} recuperou ${heal} DEF!`);
  },

  meteorRain(ctx, effect) {
    const damage = effect?.args?.damage ?? 100;
    const zones = ["campo1", "campo2", "bancoEnemy"];
    let hitCount = 0;

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;
        if (unit.owner === "player") return;

        window.applyDamageToCard?.(unit.card, damage);
        hitCount++;
      });
    });

    if (hitCount > 0) {
      EFFECT_UTILS.warn(`☄️ Chuva de Meteoros atingiu ${hitCount} unidades!`);
    }

    window.cleanupDeadUnits?.();
    window.renderAll?.();
  },

  superNova(ctx, effect) {
    const damage = effect?.args?.damage ?? 100;
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];
    let hit = 0;

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;

        window.applyDamageToCard?.(unit.card, damage);
        hit++;
      });
    });

    EFFECT_UTILS.warn(`💥 SuperNova atingiu ${hit} unidades!`);
    window.cleanupDeadUnits?.();
    window.renderAll?.();
  },

  warMachineSplash(ctx, effect) {
    if (!ctx.card) return;

    const damage = effect?.args?.damage ?? 500;
    const adjacentZones = ["campo1", "campo2"];

    adjacentZones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;
        if (unit.owner === ctx.owner) return;
        if (unit.card === ctx.card) return;

        window.applyDamageToCard?.(unit.card, damage, ctx.card);
      });
    });

    EFFECT_UTILS.warn(`🤖 ${ctx.card.name} causou ${damage} de dano em tropas adjacentes!`);
    window.cleanupDeadUnits?.();
    window.renderAll?.();
  },

  poisonByEnemyHand(ctx, effect) {
    const damage = effect?.args?.damage ?? 300;
    const enemyHandCount = window.enemyHand?.length ?? 0;

    if (enemyHandCount <= 0) {
      EFFECT_UTILS.warn("☠️ O oponente não tem cartas na mão.");
      return;
    }

    const enemyUnits = [
      ...(window.board?.campo2 || []).filter(u => u.owner !== "player"),
      ...(window.board?.bancoEnemy || []).filter(u => u.owner !== "player")
    ];

    if (enemyUnits.length === 0) {
      EFFECT_UTILS.warn("☠️ Não há unidades inimigas em campo.");
      return;
    }

    const targetsToHit = Math.min(enemyHandCount, enemyUnits.length);

    for (let i = 0; i < targetsToHit; i++) {
      window.applyDamageToCard?.(enemyUnits[i].card, damage);
    }

    EFFECT_UTILS.warn(`☠️ Envenenar causou ${damage} de dano em ${targetsToHit} unidade(s)!`);
    window.cleanupDeadUnits?.();
    window.renderAll?.();
  },

  rotTarget() {
    const target = EFFECT_UTILS.chooseFirstDamagedUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("☠️ Nenhuma unidade danificada.");
      return;
    }

    target.card.rotUntilTurn = window.turnNumber;
    target.card.__rotOriginalDefense = target.card.defense;
    target.card.defense = 0;

    EFFECT_UTILS.warn(`☠️ ${target.card.name} está apodrecendo até o fim do turno!`);
    window.renderAll?.();
  }
};
// ======================================================
// ENERGIA
// ======================================================
const EFFECT_ENERGY = {
  gainEnergyAura(ctx, effect) {
    if (ctx.owner !== "player") return;

    const amount = effect?.args?.amount ?? 1;

    window.playerPE += amount;
    if (window.playerPE > window.maxPE) {
      window.playerPE = window.maxPE;
    }

    EFFECT_UTILS.warn(`⚡ Gyokuyo gerou +${amount} PE`);
  },

  warIncentive() {
    window.__attackDiscountThisTurn = 2;
    EFFECT_UTILS.warn("⚔ Suas unidades custam -2 PE para atacar neste turno!");
  },

  superCharge(ctx, effect) {
    const amount = effect?.args?.amount ?? 4;
    window.__bonusPENextTurn = (window.__bonusPENextTurn || 0) + amount;
  },

  stealSavedEnergy() {
    const saved = window.__enemySavedPE || 0;

    if (saved <= 0) {
      EFFECT_UTILS.warn("⚡ O oponente não guardou PE.");
      return;
    }

    window.playerPE += saved;
    if (window.playerPE > window.maxPE) {
      window.playerPE = window.maxPE;
    }

    window.__enemySavedPE = 0;
    EFFECT_UTILS.warn(`⚡ Recursos Emergentes roubou ${saved} PE!`);
  },

  dirtyStrikeSacrifice() {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidade para sacrificar.");
      return;
    }

    const gainPE = target.card.cost ?? 0;
    target.card.defense = 0;

    window.playerPE += gainPE;
    if (window.playerPE > window.maxPE) {
      window.playerPE = window.maxPE;
    }

    EFFECT_UTILS.warn(`🩸 ${target.card.name} foi sacrificada! Você ganhou ${gainPE} PE.`);

    window.cleanupDeadUnits?.();
    window.renderAll?.();
  },

  thiefDrainEnergy(ctx) {
    if (ctx.owner !== "player") return;

    if (typeof window.enemyPE === "number" && window.enemyPE > 0) {
      window.enemyPE -= 1;
      EFFECT_UTILS.warn("🗡️ Pequeno Ladrão roubou 1 PE do oponente!");
    }
  }
};
// ======================================================
// CEMITÉRIO / COMPRA / BARALHO
// ======================================================
const EFFECT_GRAVEYARD = {
  reviveFromGrave() {
    if (!window.graveyardPlayer || window.graveyardPlayer.length === 0) {
      EFFECT_UTILS.warn("⚠ Seu cemitério está vazio.");
      return;
    }

    if (!window.board?.bancoPlayer) return;

    if (window.board.bancoPlayer.length >= 6) {
      EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
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
      EFFECT_UTILS.warn("⚠ Não há unidade para reviver.");
      return;
    }

    const revivedCard = structuredClone(window.graveyardPlayer.splice(reviveIndex, 1)[0]);

    revivedCard.defense = Math.max(1, revivedCard.defense || 1);
    revivedCard.summonedTurn = window.turnNumber;
    revivedCard.actionTurn = window.turnNumber;
    revivedCard.tempBuffs = revivedCard.tempBuffs || [];
    revivedCard.__lastOwner = "player";

    window.board.bancoPlayer.push({
      owner: "player",
      card: revivedCard
    });

    EFFECT_UTILS.warn(`✨ ${revivedCard.name} voltou do cemitério!`);
  },

  reaverRevive() {
    if (window.board.bancoPlayer.length >= 6) {
      EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
      return;
    }

    const grave = (window.graveyardPlayer || []).filter(card => card && card.cardClass === "unit");

    if (grave.length === 0) {
      EFFECT_UTILS.warn("⚠ Não há unidades no seu cemitério.");
      return;
    }

    const revivedCard = structuredClone(grave[0]);

    const index = window.graveyardPlayer.findIndex(card =>
      card && card.id === revivedCard.id && card.cardClass === "unit"
    );

    if (index !== -1) {
      window.graveyardPlayer.splice(index, 1);
    }

    revivedCard.summonedTurn = window.turnNumber;
    revivedCard.actionTurn = window.turnNumber;
    revivedCard.__lastOwner = "player";

    const unit = {
      owner: "player",
      card: revivedCard
    };

    window.board.bancoPlayer.push(unit);

    window.runEffects?.(revivedCard, "onSummon", {
      card: revivedCard,
      owner: "player",
      board: window.board,
      cleanupDead: window.cleanupDeadUnits
    });

    EFFECT_UTILS.warn(`☠️ ${revivedCard.name} voltou do cemitério!`);
    window.syncGlobals?.();
    window.renderAll?.();
  },

  singularityShuffleGraves(ctx, effect) {
    const amount = effect?.args?.amount ?? 10;

    if (!window.graveyardPlayer || !window.graveyardEnemy) return;
    if (!window.playerDeck || !window.enemyDeck) return;

    const playerCards = window.graveyardPlayer.splice(0, amount);
    const enemyCards = window.graveyardEnemy.splice(0, amount);

    playerCards.forEach(card => {
      const cloned = structuredClone(card);
      cloned.tempBuffs = [];
      cloned.summonedTurn = null;
      cloned.actionTurn = null;
      window.playerDeck.push(cloned);
    });

    enemyCards.forEach(card => {
      const cloned = structuredClone(card);
      cloned.tempBuffs = [];
      cloned.summonedTurn = null;
      cloned.actionTurn = null;
      window.enemyDeck.push(cloned);
    });

    window.playerDeck.sort(() => Math.random() - 0.5);
    window.enemyDeck.sort(() => Math.random() - 0.5);

    EFFECT_UTILS.warn("🌀 Cartas dos cemitérios foram embaralhadas nos baralhos.");
  },

  oneirosPortal() {
    if (!window.playerDeck || window.playerDeck.length === 0) {
      EFFECT_UTILS.warn("⚠ Seu baralho está vazio.");
      return;
    }

    const topCard = window.playerDeck[window.playerDeck.length - 1];
    if (!topCard) {
      EFFECT_UTILS.warn("⚠ Não foi possível ver a carta do topo.");
      return;
    }

    if (topCard.cardClass === "unit") {
      if (window.playerHand.length >= 10) {
        const discarded = window.playerDeck.pop();

        window.graveHistory ||= [];
        window.graveHistory.unshift({
          card: structuredClone(discarded),
          turn: window.turnNumber,
          owner: "player"
        });

        window.graveyardPlayer.push(structuredClone(discarded));
        EFFECT_UTILS.warn(`🌀 ${discarded.name} era unidade, mas sua mão estava cheia e ela foi descartada.`);
        return;
      }

      const drawn = window.playerDeck.pop();
      window.playerHand.push(drawn);
      EFFECT_UTILS.warn(`🌀 Você revelou ${drawn.name} e colocou na mão!`);
      return;
    }

    const discarded = window.playerDeck.pop();

    window.graveHistory ||= [];
    window.graveHistory.unshift({
      card: structuredClone(discarded),
      turn: window.turnNumber,
      owner: "player"
    });

    window.graveyardPlayer.push(structuredClone(discarded));
    EFFECT_UTILS.warn(`🌀 Você revelou ${discarded.name}. Como não era unidade, foi descartada.`);
  },

  contrabandoDraw() {
    window.drawCardPlayer?.();
    window.drawCardPlayer?.();
    EFFECT_UTILS.warn("📦 Contrabando comprou 2 cartas!");
  },

  northernConvoy() {
    if ((window.playerDeck || []).length < 3) {
      EFFECT_UTILS.warn("⚠ Deck não tem cartas suficientes.");
      return;
    }

    const drawn = [
      window.playerDeck.pop(),
      window.playerDeck.pop(),
      window.playerDeck.pop()
    ];

    const names = drawn.map((c, i) => `${i + 1}: ${c.name}`).join("\n");
    const choice = parseInt(prompt(`Escolha uma carta:\n${names}`), 10);

    if (!choice || choice < 1 || choice > 3) {
      drawn.reverse().forEach(card => window.playerDeck.push(card));
      EFFECT_UTILS.warn("Escolha inválida.");
      return;
    }

    const chosen = drawn[choice - 1];

    if ((window.playerHand || []).length < 10) {
      window.playerHand.push(chosen);
    } else {
      window.graveyardPlayer.push(structuredClone(chosen));
    }

    drawn.forEach((card, i) => {
      if (i !== choice - 1) {
        window.graveyardPlayer.push(card);
      }
    });

    EFFECT_UTILS.warn(`🚂 ${chosen.name} foi adicionada à sua mão.`);
    window.renderAll?.();
  },

  returnAllEnemyUnitsToHand() {
    const zones = ["bancoEnemy", "campo1", "campo2"];
    const returnedCards = [];

    zones.forEach(zone => {
      const remaining = [];

      (window.board?.[zone] || []).forEach(unit => {
        if (unit.owner !== "player" && unit.card) {
          returnedCards.push(structuredClone(unit.card));
        } else {
          remaining.push(unit);
        }
      });

      window.board[zone] = remaining;
    });

    returnedCards.forEach(card => {
      if (window.enemyHand.length < 10) {
        window.enemyHand.push(card);
      } else {
        window.graveHistory ||= [];
        window.graveHistory.unshift({
          card: structuredClone(card),
          turn: window.turnNumber,
          owner: "enemy"
        });

        window.graveyardEnemy.push(structuredClone(card));
      }
    });

    EFFECT_UTILS.warn("👑 Todas as unidades inimigas em campo retornaram para a mão.");
  }
};
// ======================================================
// CONTRAMEDIDAS / CONTROLE
// ======================================================
const EFFECT_COUNTERS = {
  mirrorCounter() {
    window.__mirrorCounterActive = true;
    EFFECT_UTILS.warn("🪞 Espelho ativado! O próximo efeito inimigo será refletido.");
  },

  necronomiconCounter() {
    window.__stealNextEnemySummon = true;
    EFFECT_UTILS.warn("📕 Necronomicon ativado! A próxima unidade inimiga será sua.");
  },

  logisticsCutCounter(ctx, effect) {
    window.__logisticsCutActive = true;
    window.__logisticsCutCost = effect?.args?.maxCost ?? 5;
    EFFECT_UTILS.warn("✂️ Corta Logística ativado!");
  },

  divideAndConquerCounter(ctx) {
    window.__divideAndConquerActive = true;
    window.__divideAndConquerOwner = ctx?.owner || "player";
    EFFECT_UTILS.warn("⚔️ Dividir e Conquistar ativado!");
  },

  lokiGripCounter() {
    window.__lokiGripActive = true;
    EFFECT_UTILS.warn("🐍 O Aperto de Lóki foi preparado!");
  },

  terminusCounter() {
    window.__terminusActive = true;
    EFFECT_UTILS.warn("☠️ Terminus foi preparado!");
  },

  incinerarTrap() {
    window.__incinerarTrapActive = true;
    EFFECT_UTILS.warn("🔥 Incinerar preparado!");
  },

  clusterAntimateria() {
    window.__clusterCounterActive = true;
    EFFECT_UTILS.warn("💠 Cluster Antimatéria preparado!");
  },

  illegalDiversionCounter() {
    window.__illegalDiversionActive = true;
    EFFECT_UTILS.warn("🕵️ Desvio Ilegal preparado!");
  },

  blefarCounter() {
    window.__blefarActive = true;
    EFFECT_UTILS.warn("🎭 Blefar foi preparado!");
  },

  armedNetCounter() {
    window.__armedNetActive = true;
    EFFECT_UTILS.warn("🕸️ Rede Armada preparada!");
  },

  quickCounterAttack() {
    if (!window.__playerWasAttackedLastTurn) {
      EFFECT_UTILS.warn("⚠ Nenhum ataque recebido no último turno.");
      return;
    }

    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (!unit?.card) return;
        if (unit.owner !== "player") return;

        unit.card.tempFlags ||= [];
        unit.card.blitz = true;
        unit.card.tempFlags.push({
          key: "blitz",
          turns: 1
        });
      });
    });

    EFFECT_UTILS.warn("⚡ Contra-ataque ativado!");
    window.renderAll?.();
  },

  quickResponseTrap() {
    window.__quickResponseTrapActive = true;
    window.__quickResponseTrapTurn = window.turnNumber + 1;
    EFFECT_UTILS.warn("⚡ Resposta Rápida preparada!");
  },

  delayCounter() {
    window.__delayCounterActive = true;
    EFFECT_UTILS.warn("⏳ Atrasar ativado.");
  },

  interceptCounter() {
    window.__interceptCounterActive = true;
    EFFECT_UTILS.warn("🛡️ Interceptar ativado.");
  },

  panicCounter() {
    window.__panicCounterActive = true;
    EFFECT_UTILS.warn("😱 Pânico ativado.");
  }
};
// ======================================================
// TEMPORAL / CAMPO / ESPECIAIS
// ======================================================
const EFFECT_TEMPORAL = {
  infiniteVoid(ctx, effect) {
    const turns = effect?.args?.turns ?? 2;
    const zones = ["campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      const units = window.board?.[zone] || [];
      units.forEach(unit => {
        if (unit.owner !== "player" && unit.card) {
          unit.card.pinnedUntilTurn = window.turnNumber + turns;
        }
      });
    });

    EFFECT_UTILS.warn(`🕳️ Vazio Imensurável paralisou o inimigo por ${turns} turnos!`);
  },

  malevolentShrine(ctx, effect) {
    window.__malevolentTurns = effect?.args?.turns ?? 6;
    window.__malevolentDamage = effect?.args?.damage ?? 300;
    EFFECT_UTILS.warn("🩸 Santuário Malevolente foi ativado!");
  },

  endlessWinter(ctx, effect) {
    const turns = effect?.args?.turns ?? 2;
    window.__endlessWinterTurns = turns;
    EFFECT_UTILS.warn(`❄️ Inverno Duradouro congelou o campo por ${turns} turnos!`);
  },

  banimentoDaLuz() {
    window.__lightBanActive = true;
    EFFECT_UTILS.warn("☀️ Suas unidades aplicam Pin neste turno!");
  },

  astrumFieldLock() {
    window.__astrumFieldLockActive = true;
    EFFECT_UTILS.warn("🌌 Astrum bloqueou todos os efeitos!");
  },

  astrumFieldUnlock() {
    window.__astrumFieldLockActive = false;
    EFFECT_UTILS.warn("🌌 O bloqueio de Astrum acabou.");
  },

  eternumLockField() {
    window.__eternumLockActive = true;
    EFFECT_UTILS.warn("⛓️ Eternum bloqueou o campo! Nenhuma unidade pode ser invocada.");
  },

  eternumUnlockField() {
    window.__eternumLockActive = false;
    EFFECT_UTILS.warn("⛓️ O bloqueio de Eternum acabou.");
  },

  swapFields() {
    const board = window.board;
    if (!board) return;

    const temp = [...board.campo1];
    board.campo1 = [...board.campo2];
    board.campo2 = temp;

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

    window.updateEudoriaPrince?.();
    EFFECT_UTILS.warn("🕳️ Horizonte de Eventos trocou o controle entre Campo 1 e Campo 2!");
    window.renderAll?.();
  },

  temporalReset() {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⏳ Nenhuma unidade sua para afetar.");
      return;
    }

    const base = window.CARD_DB?.[target.card.id];
    if (!base) return;

    target.card.attack = base.attack;
    target.card.defense = base.defense;
    target.card.tempBuffs = [];
    target.card.tempFlags = [];
    target.card.smokescreen = true;

    EFFECT_UTILS.warn(`⏳ ${target.card.name} voltou ao estado original!`);
    window.renderAll?.();
  },

  rewindCard() {
    const zones = ["bancoPlayer", "campo1", "campo2"];
    let targetZone = null;
    let targetIndex = -1;

    for (const zone of zones) {
      const index = (window.board?.[zone] || []).findIndex(u => u.owner === "player");
      if (index !== -1) {
        targetZone = zone;
        targetIndex = index;
        break;
      }
    }

    if (targetZone === null) {
      EFFECT_UTILS.warn("⏳ Nenhuma carta sua em campo.");
      return;
    }

    const unit = window.board[targetZone][targetIndex];

    if ((window.playerHand || []).length >= 10) {
      EFFECT_UTILS.warn("⚠ Sua mão está cheia!");
      return;
    }

    window.board[targetZone].splice(targetIndex, 1);

    const freshCard = window.createCardFromId?.(unit.card.id);
    if (!freshCard) return;

    window.playerHand.push(freshCard);

    EFFECT_UTILS.warn(`⏳ ${unit.card.name} voltou para sua mão!`);
    window.renderAll?.();
  },

  temporalPulse() {
    const lastTurn = window.turnNumber - 1;

    const valid = (window.graveHistory || []).filter(entry =>
      entry.owner === "player" &&
      entry.turn === lastTurn &&
      entry.card.cardClass === "unit"
    );

    if (valid.length === 0) {
      EFFECT_UTILS.warn("⏳ Nenhuma unidade do último turno.");
      return;
    }

    if ((window.board?.bancoPlayer || []).length >= 6) {
      EFFECT_UTILS.warn("⚠ Banco cheio.");
      return;
    }

    const chosen = valid[0].card;
    const revived = window.createCardFromId?.(chosen.id);

    if (!revived) return;

    window.board.bancoPlayer.push({
      owner: "player",
      card: revived
    });

    EFFECT_UTILS.warn(`⏳ ${revived.name} retornou pelo Pulso Temporal!`);
    window.renderAll?.();
  },

  timeJump() {
    window.__skipPENextTurnGain = true;
    window.__bonusPENextTurn = (window.__bonusPENextTurn || 0) + 2;
    EFFECT_UTILS.warn("⏳ Salto Temporal ativado!");
  },

  freezeUnit(ctx, effect) {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("❄️ Nenhuma unidade para congelar.");
      return;
    }

    const turns = effect?.args?.turns ?? 2;
    target.card.frozenUntilTurn = window.turnNumber + turns;

    EFFECT_UTILS.warn(`❄️ ${target.card.name} foi congelada por ${turns} turnos!`);
    window.renderAll?.();
  }
};

// ======================================================
// ESPECIAIS / CARTAS ÚNICAS
// ======================================================
const EFFECT_SPECIAL = {
  revealEnemyHandCard() {
    if (!window.enemyHand || window.enemyHand.length === 0) {
      EFFECT_UTILS.warn("👁️ O oponente não tem cartas na mão.");
      return;
    }

    const revealed = window.enemyHand[Math.floor(Math.random() * window.enemyHand.length)];
    if (!revealed) return;

    EFFECT_UTILS.warn(`👁️ Olho de Hórus revelou: ${revealed.name}`);
  },

  equalizeUnitStats(ctx) {
    const target =
      typeof ctx.getEnemyTarget === "function"
        ? ctx.getEnemyTarget()
        : (
            window.board?.campo2?.find(u => u.owner !== "player") ||
            window.board?.bancoEnemy?.find(u => u.owner !== "player") ||
            window.board?.campo1?.find(u => u.owner === "player") ||
            window.board?.bancoPlayer?.find(u => u.owner === "player")
          );

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Não há unidade em campo para igualar.");
      return;
    }

    const value = Math.max(target.card.attack || 0, target.card.defense || 0);
    target.card.attack = value;
    target.card.defense = value;

    EFFECT_UTILS.warn(`⚖️ ${target.card.name} ficou com ${value}/${value}.`);
  },

  forcedSwapEnemyUnits() {
    const active = window.board?.campo2?.find(u => u.owner !== "player");
    const bench = window.board?.bancoEnemy?.find(u => u.owner !== "player");

    if (!active || !bench) {
      EFFECT_UTILS.warn("⚠ O inimigo precisa ter unidade no campo ativo e no banco.");
      return;
    }

    window.board.campo2 = window.board.campo2.filter(u => u !== active);
    window.board.bancoEnemy = window.board.bancoEnemy.filter(u => u !== bench);

    window.board.campo2.push(bench);
    window.board.bancoEnemy.push(active);

    EFFECT_UTILS.warn(`🔄 ${active.card.name} trocou com ${bench.card.name}!`);
  },

  judgmentCoinFlipSameRarity() {
    const ally =
      window.board?.campo2?.find(u => u.owner === "player") ||
      window.board?.campo1?.find(u => u.owner === "player") ||
      window.board?.bancoPlayer?.find(u => u.owner === "player");

    if (!ally?.card) {
      EFFECT_UTILS.warn("⚠ Você não tem unidade em campo.");
      return;
    }

    const allyRarity = ally.card.rarity || ally.card.raridade;

    const enemy =
      window.board?.campo2?.find(u => u.owner !== "player" && (u.card.rarity || u.card.raridade) === allyRarity) ||
      window.board?.bancoEnemy?.find(u => u.owner !== "player" && (u.card.rarity || u.card.raridade) === allyRarity);

    if (!enemy?.card) {
      EFFECT_UTILS.warn("⚠ Não existe unidade inimiga de mesma raridade.");
      return;
    }

    const coin = Math.random() < 0.5 ? "cara" : "coroa";

    if (coin === "cara") {
      ally.card.defense = 0;
      EFFECT_UTILS.warn(`🪙 Cara! ${ally.card.name} foi destruída.`);
    } else {
      enemy.card.defense = 0;
      EFFECT_UTILS.warn(`🪙 Coroa! ${enemy.card.name} foi destruída.`);
    }

    window.cleanupDeadUnits?.();
  },

  summonVoidServants(ctx, effect) {
    const amount = effect?.args?.amount ?? 2;
    let summoned = 0;

    for (let i = window.playerDeck.length - 1; i >= 0; i--) {
      if (summoned >= amount) break;

      const card = window.playerDeck[i];

      if (card?.cardClass === "unit" && card?.tags?.includes("void")) {
        if (window.board.bancoPlayer.length >= 6) break;

        window.playerDeck.splice(i, 1);

        card.summonedTurn = window.turnNumber;
        card.actionTurn = window.turnNumber;
        card.__lastOwner = "player";

        const unit = {
          owner: "player",
          card
        };

        window.board.bancoPlayer.push(unit);

        window.runEffects?.(card, "onSummon", {
          card,
          owner: "player",
          board: window.board,
          cleanupDead: window.cleanupDeadUnits
        });

        summoned++;
      }
    }

    EFFECT_UTILS.warn(`🌌 ${summoned} servo(s) do vazio invocado(s)!`);
    window.syncGlobals?.();
    window.renderAll?.();
  },

  voidServantsBlitz(ctx) {
    const zones = ["bancoPlayer", "campo1", "campo2"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit.owner === ctx.owner && unit.card?.tags?.includes("void")) {
          unit.card.blitz = true;
        }
      });
    });
  },

  aurumShuffleHand(ctx) {
    if (ctx.owner !== "player") return;
    if (!window.playerHand || window.playerHand.length === 0) return;
    if (!window.playerDeck) return;

    const amount = window.playerHand.length;

    while (window.playerHand.length > 0) {
      const card = window.playerHand.pop();

      card.summonedTurn = null;
      card.actionTurn = null;
      card.tempBuffs = [];
      card.tempFlags = [];

      window.playerDeck.push(card);
    }

    window.playerDeck.sort(() => Math.random() - 0.5);

    for (let i = 0; i < amount; i++) {
      if (window.playerDeck.length === 0) break;
      if (window.playerHand.length >= 10) break;

      const drawn = window.playerDeck.pop();
      window.playerHand.push(drawn);
    }

    EFFECT_UTILS.warn(`🌟 Aurum embaralhou sua mão e comprou ${Math.min(amount, 10)} carta(s)!`);
  },

  sideralInfection(ctx, effect) {
    const damage = effect?.args?.damage ?? 500;

    const target =
      (window.board?.campo2 || []).find(u => u.owner !== "player") ||
      (window.board?.bancoEnemy || []).find(u => u.owner !== "player");

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Não há unidade inimiga para infectar.");
      return;
    }

    target.card.sideralInfection = {
      damage,
      startedTurn: window.turnNumber,
      spreadReadyTurn: window.turnNumber + 1,
      spreadDone: false
    };

    EFFECT_UTILS.warn(`🦠 ${target.card.name} foi infectada!`);
  },

  vultureCheckInfectionKills() {
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        const infection = unit.card?.sideralInfection;
        if (!infection) return;

        if (unit.card.defense <= 0 && !unit.card.__countedByVulture) {
          unit.card.__countedByVulture = true;

          const vultures = EFFECT_UTILS.getPlayerUnits().filter(u => u.card.id === "J013");

          vultures.forEach(v => {
            if (!EFFECT_UTILS.canReceiveBuff(v.card)) return;

            v.card.attack += 400;
            v.card.defense += 400;
            EFFECT_UTILS.warn(`🦅 Abutre Cósmico ficou mais forte!`);
          });
        }
      });
    });
  },

  wormholeSummon() {
    if (!window.playerHand || window.playerHand.length === 0) {
      EFFECT_UTILS.warn("⚠ Você não tem cartas na mão.");
      return;
    }

    if (window.board.bancoPlayer.length >= 6) {
      EFFECT_UTILS.warn("⚠ Seu banco está cheio.");
      return;
    }

    const index = window.playerHand.findIndex(c => c.cardClass === "unit");

    if (index === -1) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade na mão.");
      return;
    }

    const card = window.playerHand.splice(index, 1)[0];

    card.summonedTurn = window.turnNumber;
    card.actionTurn = window.turnNumber;
    card.__lastOwner = "player";
    card.summonedByWormhole = true;

    const unit = {
      owner: "player",
      card
    };

    window.board.bancoPlayer.push(unit);

    window.runEffects?.(card, "onSummon", {
      card,
      owner: "player",
      board: window.board,
      cleanupDead: window.cleanupDeadUnits
    });

    EFFECT_UTILS.warn(`🌀 ${card.name} entrou em campo através do Buraco de Minhoca!`);

    window.syncGlobals?.();
    window.renderAll?.();
  },

  xmAresWormholeBuff(ctx) {
    if (!ctx.card) return;

    if (ctx.card.summonedByWormhole) {
      ctx.card.attackCost = 0;
      EFFECT_UTILS.warn("🤖 XM-Ares foi invocado por Buraco de Minhoca e ficou com ATK 0 neste turno!");
    }
  },

  conquerorInsignia() {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade para receber a Insígnia.");
      return;
    }

    if (target.card.immuneToConquerorInsignia) {
      EFFECT_UTILS.warn(`🛡 ${target.card.name} não pode receber a Insígnia do Conquistador!`);
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack += 800;
    EFFECT_UTILS.warn(`🏅 ${target.card.name} recebeu +800 ATK!`);
  },

  eudoriaPrinceInit(ctx) {
    if (!ctx.card) return;
    ctx.card.baseAttackEudoria = ctx.card.attack;
    window.updateEudoriaPrince?.();
  },

  terraBladeEquip() {
    const target =
      window.board?.campo2?.find(u => u.card?.id === "J015") ||
      window.board?.campo1?.find(u => u.card?.id === "J015") ||
      window.board?.bancoPlayer?.find(u => u.card?.id === "J015");

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Terra-Blade só pode ser usada no Herói Sem Nome.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.attack += 2000;
    EFFECT_UTILS.warn(`🗡️ Terra-Blade fortaleceu ${target.card.name}! +2000 ATK`);
  },

  strategistPeekTopDeck(ctx) {
    if (!ctx.card) return;
    if (ctx.owner !== "player") return;
    if (!window.playerDeck || window.playerDeck.length === 0) {
      EFFECT_UTILS.warn("🧠 Seu baralho está vazio.");
      return;
    }

    const topCard = window.playerDeck[window.playerDeck.length - 1];
    if (!topCard) return;

    EFFECT_UTILS.warn(`🧠 Topo do deck: ${topCard.name}`);
  },

  dandelionEffect(ctx) {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade aliada.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.effectImmune = true;
    EFFECT_UTILS.warn(`🌼 ${target.card.name} agora está imune a efeitos!`);
    window.renderAll?.();
  },

  armorPierceBuff(ctx, effect) {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade para buffar.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    const amount = effect?.args?.amount ?? 1;
    target.card.armorPierce = (target.card.armorPierce || 0) + amount;

    EFFECT_UTILS.warn(`🗡️ ${target.card.name} agora ignora ${amount} nível de Armadura Pesada!`);
    window.renderAll?.();
  },

  gungnirBuff() {
    const target = EFFECT_UTILS.getFirstPlayerUnit();

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade para receber Gungnir.");
      return;
    }

    if (!EFFECT_UTILS.canReceiveBuff(target.card)) return;

    target.card.ignoreHeavyArmor = true;

    EFFECT_UTILS.warn(`⚔️ ${target.card.name} agora ignora Armadura Pesada!`);
    window.renderAll?.();
  },

  devourAllUnits(ctx) {
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      const units = [...(window.board?.[zone] || [])];
      units.forEach(unit => {
        if (unit?.card) unit.card.defense = 0;
      });
    });

    EFFECT_UTILS.cleanup(ctx);

    if (ctx.owner === "player") {
      window.playerLife -= 1;
    } else {
      window.enemyLife -= 1;
    }
  },

  reapStrike(ctx, effect) {
    const damage = effect?.args?.damage ?? 1000;
    const maxCost = effect?.args?.maxCost ?? 7;

    const target =
      window.board?.campo2?.find(u => u.owner !== "player" && (u.card.cost ?? 0) <= maxCost) ||
      window.board?.bancoEnemy?.find(u => u.owner !== "player" && (u.card.cost ?? 0) <= maxCost);

    if (!target?.card) {
      EFFECT_UTILS.warn("⚠ Nenhuma unidade válida para Ceifar.");
      return;
    }

    window.applyDamageToCard?.(target.card, damage);
    EFFECT_UTILS.warn(`🪓 Ceifar causou ${damage} de dano em ${target.card.name}!`);
    window.cleanupDeadUnits?.();
  },

  reduceEnemyActiveAttack(ctx, effect) {
    const amount = effect?.args?.amount ?? 300;

    ["campo1", "campo2"].forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit.owner !== ctx.owner && unit.card) {
          unit.card.attack -= amount;
          unit.card.tempBuffs ||= [];
          unit.card.tempBuffs.push({
            stat: "attack",
            amount: -amount,
            turns: 1
          });
        }
      });
    });

    EFFECT_UTILS.warn(`💀 Unidades inimigas perderam ${amount} de ataque!`);
  },

  halveEnemyStats(ctx) {
    const zones = ["bancoPlayer", "campo1", "campo2", "bancoEnemy"];

    zones.forEach(zone => {
      (window.board?.[zone] || []).forEach(unit => {
        if (unit.owner !== ctx.owner && unit.card) {
          unit.card.attack = Math.floor(unit.card.attack / 2);
          unit.card.defense = Math.floor(unit.card.defense / 2);
        }
      });
    });

    EFFECT_UTILS.warn("🔥 Terra Arrasada reduziu os atributos inimigos pela metade!");
  },

  tyrannosaurusMobilize() {
    const board = window.board;
    if (!board) return;

    const enemyZones = ["campo1", "campo2"];
    const moved = [];

    enemyZones.forEach(zone => {
      const units = [...(board[zone] || [])];

      units.forEach(unit => {
        if (unit.owner !== "enemy") return;

        if (board.bancoEnemy.length < 6) {
          board[zone] = board[zone].filter(u => u !== unit);
          board.bancoEnemy.push(unit);
          moved.push(unit.card.name);
        }
      });
    });

    if (moved.length > 0) {
      EFFECT_UTILS.warn(`🦖 Tiranossauro empurrou ${moved.length} unidades para o banco!`);
    }

    window.renderAll?.();
  },

  necromancerRevive() {
    if ((window.graveyardPlayer || []).length === 0) {
      EFFECT_UTILS.warn("💀 Não há cartas no cemitério.");
      return;
    }

    if ((window.board?.bancoPlayer || []).length >= 6) {
      EFFECT_UTILS.warn("💀 Banco cheio!");
      return;
    }

    window.__necromancerReviveActive = true;

    if (typeof window.openGraveyard === "function") {
      window.openGraveyard(window.graveyardPlayer, "Escolha uma carta para reviver");
    }

    EFFECT_UTILS.warn("💀 Escolha uma carta do cemitério.");
  }
};


window.EFFECTS = {
  ...EFFECT_UTILS,
  ...EFFECT_BASICS,
  ...EFFECT_UNITS,
  ...EFFECT_DAMAGE,
  ...EFFECT_ENERGY,
  ...EFFECT_GRAVEYARD,
  ...EFFECT_COUNTERS,
  ...EFFECT_TEMPORAL,
  ...EFFECT_SPECIAL
};
