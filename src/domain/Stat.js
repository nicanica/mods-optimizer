// @flow

import statTypeMap from "../constants/statTypeMap";
import {modStats} from "../constants/enums";

class Stat {
  displayModifier;
  type;
  displayType;
  rawValue;
  value;
  isPercent;
  rolls;

  constructor(type, value, rolls = 1) {
    this.displayModifier = type.endsWith('%') || value.endsWith('%') ? '%' : '';
    this.type = type;
    this.displayType = type.endsWith('%') ? type.substr(0, type.length - 1).trim() : type;
    this.rawValue = value.replace(/[+%]/g, '');
    this.value = +this.rawValue;
    this.isPercent = '%' === this.displayModifier && Stat.mixedTypes.includes(this.displayType);
    this.rolls = rolls;
    this.updateDisplayValue();
  }

  /**
   * Return a CSS class to represent this stat
   */
  getClass() {
    switch (this.rolls) {
      case 5:
        return 'S';
      case 4:
        return 'A';
      case 3:
        return 'B';
      case 2:
        return 'C';
      default:
        return 'D';
    }
  }

  /**
   * Update the displayed value for this stat to match the value held in the stat. This is useful if the stat
   * value was updated
   */
  updateDisplayValue() {
    this.displayValue = `${this.value % 1 ? Math.round(this.value * 100) / 100 : this.value}`;
  }

  /**
   * Return a string that represents this stat
   */
  show() {
    return `${this.showValue()} ${this.displayType}`;
  }

  /**
   * Return only the value of this stat as a string
   * @returns {string}
   */
  showValue() {
    return `${this.displayValue}${this.displayModifier}`;
  }

  /**
   * Take the difference between this stat and that stat
   *
   * @param that {Stat}
   * @returns {Stat} with the same type and a value representing the difference
   */
  minus(that) {
    if (!(that instanceof Stat)) {
      throw new Error("Can't take the difference between a Stat and a non-Stat");
    }
    if (that.type !== this.type) {
      throw new Error("Can't take the difference between Stats of different types");
    }
    let valueDiff = this.value - that.value;
    if (valueDiff % 1) {
      valueDiff = `${valueDiff.toFixed(2)}`;
    } else {
      valueDiff = `${valueDiff}`;
    }

    return new Stat(this.type, `${valueDiff}${this.displayModifier}`);
  }

  /**
   * Add two stats together, producing a new stat with the sum of their values
   *
   * @param that {Stat}
   * @returns {Stat} with the same type and a value representing the sum
   */
  plus(that) {
    if (!(that instanceof Stat)) {
      throw new Error("Can't add a non-Stat to a Stat");
    }
    if (that.displayType !== this.displayType || that.isPercent !== this.isPercent) {
      throw new Error("Can't add two Stats of different types");
    }
    const valueSum = this.value + that.value;

    return new Stat(this.type, `${valueSum}${this.displayModifier}`);
  }

  /**
   * Convert this stat to one or more with flat values, even if it had a percent-based value before
   * @param character
   * @returns {Array<Stat>}
   */
  getFlatValuesForCharacter(character) {
    const statPropertyNames = statTypeMap[this.displayType];

    return statPropertyNames.map(statName => {
      const displayName = Stat.displayNames[statName];
      const statType = Stat.mixedTypes.includes(displayName) ? displayName : `${displayName} %`;

      if (this.isPercent && character.playerValues.baseStats) {
        return new Stat(statType, `${this.value * character.playerValues.baseStats[statName] / 100}`);
      } else if (!this.isPercent) {
        return new Stat(statType, this.rawValue);
      } else {
        throw new Error(`Stat is given as a percentage, but ${character.baseID} has no base stats`);
      }
    });
  }

  /**
   * Return the value this stat would have as a primary stat at level 15 for a mod of the given number of pips
   * @param modPips int
   */
  upgradePrimary(modPips) {
    if (Stat.maxPrimaries.hasOwnProperty(this.displayType)) {
      return new Stat(this.type, Stat.maxPrimaries[this.displayType][modPips]);
    } else {
      return this;
    }
  }

  /**
   * Return the value this stat would have if it were upgraded on a mod sliced from 5A to 6E
   * @returns {Stat}
   */
  upgradeSecondary() {
    if (Stat.secondaryUpgradeFactors.hasOwnProperty(this.type)) {
      return new Stat(this.type, `${Stat.secondaryUpgradeFactors[this.type] * this.value}`)
    } else if ('Speed' === this.type) {
      return new Stat(this.type, `${this.value + 1}`)
    } else {
      return this;
    }
  }

  /**
   * Get the value of this stat for optimization
   *
   * @param character
   */
  getOptimizationValue(character) {
    // Optimization Plans don't have separate physical and special critical chances, since both are always affected
    // equally. If this is a physical crit chance stat, then use 'critChance' as the stat type. If it's special crit
    // chance, ignore it altogether.
    if (this.displayType === 'Special Critical Chance') {
      return 0;
    }

    const statTypes = 'Physical Critical Chance' === this.displayType ? ['critChance'] : statTypeMap[this.displayType];

    if (this.isPercent) {
      return statTypes.map(statType =>
        character.optimizerSettings.target[statType] *
        Math.floor(character.playerValues.baseStats[statType] * this.value / 100)
      ).reduce((a, b) => a + b, 0);
    } else {
      return statTypes.map(statType =>
        character.optimizerSettings.target[statType] * this.value
      ).reduce((a, b) => a + b, 0);
    }
  }

  /**
   * Extract the type and value of this stat for serialization
   */
  serialize() {
    const percent = (this.isPercent || !Stat.mixedTypes.includes(this.displayType)) &&
    !this.type.includes('%') ? '%' : '';

    return [this.type, `+${this.rawValue}${percent}`, this.rolls];
  }

  /**
   * Deserialize a stat from a swgoh.help API response
   * @param statJson {{}}
   * @returns {Stat}
   */
  static fromSwgohHelp(statJson) {
    return new Stat(modStats[statJson.unitStat], `${statJson.value}`, statJson.roll);
  }
}

// A list of stat types that can be either a flat value or a percent
Stat.mixedTypes = ['Health',
  'Protection',
  'Offense',
  'Physical Damage',
  'Special Damage',
  'Speed',
  'Defense',
  'Armor',
  'Resistance'];

// A map from the internal name to a more human-friendly name for each stat type
Stat.displayNames = {
  'health': 'Health',
  'protection': 'Protection',
  'speed': 'Speed',
  'critDmg': 'Critical Damage',
  'potency': 'Potency',
  'tenacity': 'Tenacity',
  'physDmg': 'Physical Damage',
  'specDmg': 'Special Damage',
  'critChance': 'Critical Chance',
  'physCritChance': 'Physical Critical Chance',
  'specCritChance': 'Special Critical Chance',
  'defense': 'Defense',
  'armor': 'Armor',
  'resistance': 'Resistance',
  'accuracy': 'Accuracy',
  'critAvoid': 'Critical Avoidance',
  'physCritAvoid': 'Physical Critical Avoidance',
  'specCritAvoid': 'Special Critical Avoidance'
};

// Map pips to maximum value at level 15 for each primary stat type
Stat.maxPrimaries = {
  'Offense': {
    1: "1.88%",
    2: "2%",
    3: "3.88%",
    4: "4%",
    5: "5.88%",
    6: "8.50%"
  },
  'Defense': {
    1: "3.75%",
    2: "4%",
    3: "7.75%",
    4: "8%",
    5: "11.75%",
    6: "20%"
  },
  'Health': {
    1: "1.88%",
    2: "2%",
    3: "3.88%",
    4: "4%",
    5: "5.88%",
    6: "16%"
  },
  'Protection': {
    1: "7.5%",
    2: "8%",
    3: "15.5%",
    4: "16%",
    5: "23.5%",
    6: "24%"
  },
  'Speed': {
    1: "17",
    2: "19",
    3: "21",
    4: "26",
    5: "30",
    6: "32"
  },
  'Accuracy': {
    1: "7.5%",
    2: "8%",
    3: "8.75%",
    4: "10.5%",
    5: "12%",
    6: "30%"
  },
  'Critical Avoidance': {
    1: "15%",
    2: "16%",
    3: "18%",
    4: "21%",
    5: "24%",
    6: "35%"
  },
  'Critical Chance': {
    1: "7.50%",
    2: "8%",
    3: "8.75%",
    4: "10.5%",
    5: "12%",
    6: "20%"
  },
  'Critical Damage': {
    1: "22.50%",
    2: "24%",
    3: "27%",
    4: "31.5%",
    5: "36%",
    6: "42%"
  },
  'Potency': {
    1: "15%",
    2: "16%",
    3: "18%",
    4: "21%",
    5: "24%",
    6: "30%"
  },
  'Tenacity': {
    1: "15%",
    2: "16%",
    3: "18%",
    4: "21%",
    5: "24%",
    6: "35%"
  }
};

Stat.secondaryUpgradeFactors = {
  'Offense %': 3.02,
  'Defense %': 2.34,
  'Health %': 1.86,
  'Defense': 1.63,
  'Tenacity %': 1.33,
  'Potency %': 1.33,
  'Protection %': 1.33,
  'Health': 1.26,
  'Protection': 1.11,
  'Offense': 1.10,
  'Critical Chance %': 1.04
};

export default Stat;
