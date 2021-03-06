// @flow
import {hideModal, updateProfile} from "./app";
import {mapObject} from "../../utils/mapObject";
import groupByKey from "../../utils/groupByKey";
import OptimizationPlan from "../../domain/OptimizationPlan";

export const CHANGE_CHARACTER_EDIT_MODE = 'CHANGE_CHARACTER_EDIT_MODE';
export const CHANGE_CHARACTER_FILTER = 'CHANGE_CHARACTER_FILTER';
export const CHANGE_SET_RESTRICTIONS = 'CHANGE_SET_RESTRICTIONS';
export const SELECT_SET_BONUS = 'SELECT_SET_BONUS';
export const REMOVE_SET_BONUS = 'REMOVE_SET_BONUS';

/**
 * Action to move a character from the "available characters" pool to the "selected characters" pool, moving the
 * character in order just underneath prevIndex, if it's supplied
 * @param characterID {String} The character ID of the character being selected
 * @param target {OptimizationPlan} The target to attach to the newly-selected character
 * @param prevIndex {Number} Where in the selected characters list to place the new character
 * @returns {Function}
 */
export function selectCharacter(characterID, target, prevIndex = null) {
  const selectedCharacter = {id: characterID, target: target};

  return updateProfile(profile => {
    const oldSelectedCharacters = profile.selectedCharacters;

    if (null === prevIndex) {
      // If there's no previous index, put the new character at the top of the list
      return profile.withSelectedCharacters([selectedCharacter].concat(oldSelectedCharacters));
    } else {
      const newSelectedCharacters = oldSelectedCharacters.slice();
      newSelectedCharacters.splice(
        prevIndex + 1,
        0,
        selectedCharacter
      );

      return profile.withSelectedCharacters(newSelectedCharacters);
    }
  });
}

/**
 * Move an already-selected character to a new position in the selected list
 * @param fromIndex {Number}
 * @param toIndex {Number}
 * @returns {Function}
 */
export function moveSelectedCharacter(fromIndex, toIndex) {
  return updateProfile(profile => {
    if (fromIndex === toIndex) {
      return profile;
    } else {
      const newSelectedCharacters = profile.selectedCharacters.slice();
      const [oldValue] = newSelectedCharacters.splice(fromIndex, 1);
      if (null === toIndex) {
        return profile.withSelectedCharacters([oldValue].concat(newSelectedCharacters));
      } else if (fromIndex < toIndex) {
        newSelectedCharacters.splice(toIndex, 0, oldValue);
        return profile.withSelectedCharacters(newSelectedCharacters);
      } else {
        newSelectedCharacters.splice(toIndex + 1, 0, oldValue);
        return profile.withSelectedCharacters(newSelectedCharacters);
      }
    }
  });
}

/**
 * Move a character from the "selected characters" pool to the "available characters" pool.
 * @param characterIndex {Number} The location of the character being unselected from the list
 * @returns {Function}
 */
export function unselectCharacter(characterIndex) {
  return updateProfile(profile => {
    const newSelectedCharacters = profile.selectedCharacters.slice();

    if (newSelectedCharacters.length > characterIndex) {
      const [oldValue] = newSelectedCharacters.splice(characterIndex, 1);
      const oldCharacter = profile.characters[oldValue.id];
      return profile.withSelectedCharacters(newSelectedCharacters)
      // If we unselect a character, we also need to unlock it
        .withCharacters(Object.assign({}, profile.characters, {
          [oldValue.id]: oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.unlock())
        }));
    } else {
      return profile;
    }
  });
}

/**
 * Action to remove all characters from the "selected characters" pool, returning them to "available characters".
 * @returns {Function}
 */
export function unselectAllCharacters() {
  return updateProfile(profile =>
    profile.withCharacters(
      mapObject(
        profile.characters,
        character => character.withOptimizerSettings(character.optimizerSettings.unlock())
      )
    ).withSelectedCharacters([]));
}

/**
 * Action to lock all characters from the "selected characters" pool
 * @returns {Function}
 */
export function lockSelectedCharacters() {
  return updateProfile(profile => {
    const selectedCharacterIDs = Object.keys(groupByKey(profile.selectedCharacters, ({id}) => id));

    return profile.withCharacters(
      mapObject(
        profile.characters,
        character => selectedCharacterIDs.includes(character.baseID) ?
          character.withOptimizerSettings(character.optimizerSettings.lock()) :
          character
      )
    );
  });
}

/**
 * Action to unlock all characters from the "selected characters" pool
 * @returns {Function}
 */
export function unlockSelectedCharacters() {
  return updateProfile(profile => {
    const selectedCharacterIDs = Object.keys(groupByKey(profile.selectedCharacters, ({id}) => id));

    return profile.withCharacters(
      mapObject(
        profile.characters,
        character => selectedCharacterIDs.includes(character.baseID) ?
          character.withOptimizerSettings(character.optimizerSettings.unlock()) :
          character
      )
    );
  });
}

/**
 * Lock a character so that their mods won't be assigned to other characters
 * @param characterID string the Character ID of the character being locked
 * @returns {Function}
 */
export function lockCharacter(characterID) {
  return updateProfile(profile => {
    const oldCharacter = profile.characters[characterID];
    const newCharacters = Object.assign({}, profile.characters, {
      [characterID]: oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.lock())
    });

    return profile.withCharacters(newCharacters);
  });
}

/**
 * Unlock a character so that their mods can be assigned to other characters
 * @param characterID string the Character ID of the character being unlocked
 * @returns {Function}
 */
export function unlockCharacter(characterID) {
  return updateProfile(profile => {
    const oldCharacter = profile.characters[characterID];
    const newCharacters = Object.assign({}, profile.characters, {
      [characterID]: oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.unlock())
    });

    return profile.withCharacters(newCharacters);
  });
}

/**
 * Action to change the selected target for a character
 * @param characterIndex {Number} The index of the selected character whose target is being updated
 * @param target {OptimizationPlan} The new target to use
 * @returns {Function}
 */
export function changeCharacterTarget(characterIndex, target) {
  return updateProfile(profile => {
    const newSelectedCharacters = profile.selectedCharacters.slice();
    if (characterIndex >= newSelectedCharacters.length) {
      return profile;
    }

    const [oldValue] = newSelectedCharacters.splice(characterIndex, 1);
    const newValue = Object.assign({}, oldValue, {target: target});
    newSelectedCharacters.splice(characterIndex, 0, newValue);

    return profile.withSelectedCharacters(newSelectedCharacters);
  });
}

/**
 * Switch between basic and advanced edit mode
 * @param mode
 * @returns {{type: string, mode: *}}
 */
export function changeCharacterEditMode(mode) {
  return {
    type: CHANGE_CHARACTER_EDIT_MODE,
    mode: mode
  };
}

/**
 * Action to complete the editing of a character target, applying the new target values to the character
 * @param characterIndex {Number} The index in the selected characters list of the character being updated
 * @param newTarget OptimizationPlan The new target to use for the character
 * @returns {Function}
 */
export function finishEditCharacterTarget(characterIndex, newTarget) {
  return updateProfile(
    profile => {
      if (characterIndex >= profile.selectedCharacters.length) {
        return profile;
      }
      const newSelectedCharacters = profile.selectedCharacters.slice();
      const [{id: characterID}] = newSelectedCharacters.splice(characterIndex, 1);
      newSelectedCharacters.splice(characterIndex, 0, {id: characterID, target: newTarget});

      const oldCharacter = profile.characters[characterID];
      const newCharacter = oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.withTarget(newTarget));

      return profile.withCharacters(Object.assign({}, profile.characters, {
        [newCharacter.baseID]: newCharacter
      })).withSelectedCharacters(newSelectedCharacters);
    },
    dispatch => {
      dispatch(hideModal());
      dispatch(changeSetRestrictions(null));
    }
  );
}

/**
 * Reset a given target for a character to its default values
 * @param characterID {String} The character ID of the character being reset
 * @param targetName {String} The name of the target to reset
 * @returns {Function}
 */
export function resetCharacterTargetToDefault(characterID, targetName) {
  return updateProfile(
    profile => {
      const newCharacter = profile.characters[characterID].withResetTarget(targetName);
      const resetTarget = newCharacter.optimizerSettings.targets.find(target => target.name === targetName) ||
        new OptimizationPlan('unnamed');

      const newSelectedCharacters = profile.selectedCharacters.map(({id, target}) =>
        id === characterID && target.name === targetName ? {id: id, target: resetTarget} : {id: id, target: target}
      );

      return profile.withCharacters(Object.assign({}, profile.characters, {
        [characterID]: newCharacter
      })).withSelectedCharacters(newSelectedCharacters);
    },
    dispatch => {
      dispatch(hideModal());
      dispatch(changeSetRestrictions(null));
    }
  );
}

/**
 * Reset all character targets so that they match the default values
 * @returns {Function}
 */
export function resetAllCharacterTargets() {
  return updateProfile(
    profile => {
      const newCharacters = mapObject(profile.characters, character => character.withResetTargets());
      const newSelectedCharacters = profile.selectedCharacters.map(({id, target: oldTarget}) => {
        const resetTarget = newCharacters[id].optimizerSettings.targets.find(target => target.name === oldTarget.name);

        return resetTarget ? {id: id, target: resetTarget} : {id: id, target: oldTarget};
      });

      return profile.withCharacters(newCharacters).withSelectedCharacters(newSelectedCharacters);
    },
    dispatch => dispatch(hideModal())
  );
}

/**
 * Delete the currently selected target for a given character
 * @param characterID {String} The character ID of the character being reset
 * @param targetName {String} The name of the target to delete
 * @returns {Function}
 */
export function deleteTarget(characterID, targetName) {
  return updateProfile(
    profile => {
      const oldCharacter = profile.characters[characterID];
      const newCharacters = Object.assign({}, profile.characters, {
        [characterID]: oldCharacter.withDeletedTarget(targetName)
      });

      const newSelectedCharacters = profile.selectedCharacters.map(({id, target: oldTarget}) => {
        if (id === characterID && oldTarget.name === targetName) {
          const newTarget = newCharacters[characterID].targets()[0] || new OptimizationPlan('unnamed');

          return {id: id, target: newTarget};
        } else {
          return {id: id, target: oldTarget};
        }
      });

      return profile.withCharacters(newCharacters).withSelectedCharacters(newSelectedCharacters);
    },
    dispatch => {
      dispatch(hideModal());
      dispatch(changeSetRestrictions(null));
    }
  );
}

/**
 * Change the minimum dots that a mod needs to be used for a character
 * @param characterID string The character ID of the character being updated
 * @param minimumModDots Integer
 * @returns {Function}
 */
export function changeMinimumModDots(characterID, minimumModDots) {
  return updateProfile(profile => {
    const oldCharacter = profile.characters[characterID];

    return profile.withCharacters(Object.assign({}, profile.characters, {
      [characterID]:
        oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.withMinimumModDots(minimumModDots))
    }));
  });
}

/**
 * Change whether to slice mods when optimizing a given character
 * @param characterID string The character ID of the character being updated
 * @param sliceMods boolean
 * @returns {Function}
 */
export function changeSliceMods(characterID, sliceMods) {
  return updateProfile(profile => {
    const oldCharacter = profile.characters[characterID];

    return profile.withCharacters(Object.assign({}, profile.characters, {
      [characterID]: oldCharacter.withOptimizerSettings(oldCharacter.optimizerSettings.withModSlicing(sliceMods))
    }));
  });
}

/**
 * Update the filter that is used to highlight available characters
 * @param newFilter string
 * @returns {{type: string, filter: *}}
 */
export function changeCharacterFilter(newFilter) {
  return {
    type: CHANGE_CHARACTER_FILTER,
    filter: newFilter
  };
}

/**
 * Update the threshold before the optimizer will suggest changing mods on a character
 * @param threshold
 * @returns {Function}
 */
export function updateModChangeThreshold(threshold) {
  return updateProfile(profile =>
    profile.withGlobalSettings(
      Object.assign({}, profile.globalSettings, {modChangeThreshold: threshold})
    )
  );
}

/**
 * Update whether to keep all unselected characters locked.
 * @param lock {boolean}
 * @returns {Function}
 */
export function updateLockUnselectedCharacters(lock) {
  return updateProfile(profile =>
    profile.withGlobalSettings(
      Object.assign({}, profile.globalSettings, {lockUnselectedCharacters: lock})
    )
  );
}

/**
 * Fill the set restrictions to display on the character edit form
 * @param setRestrictions
 * @returns {{setRestrictions: *, type: string}}
 */
export function changeSetRestrictions(setRestrictions) {
  return {
    type: CHANGE_SET_RESTRICTIONS,
    setRestrictions: setRestrictions
  };
}

/**
 * Add a set bonus to the currently selected sets
 *
 * @param setBonus
 * @returns {{setBonus: *, type: string}}
 */
export function selectSetBonus(setBonus) {
  return {
    type: SELECT_SET_BONUS,
    setBonus: setBonus
  };
}

/**
 * Remove a set bonus from the currently selected sets
 *
 * @param setBonus
 * @returns {{setBonus: *, type: string}}
 */
export function removeSetBonus(setBonus) {
  return {
    type: REMOVE_SET_BONUS,
    setBonus: setBonus
  };
}
