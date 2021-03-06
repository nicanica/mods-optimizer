import getDatabase from "../storage/Database";
import {mapObject} from "../../utils/mapObject";
import OptimizerRun from "../../domain/OptimizerRun";
import nothing from "../../utils/nothing";
import {showError, showFlash} from "./app";
import groupByKey from "../../utils/groupByKey";

export const CLEAN_STATE = 'CLEAN_STATE';
export const SET_GAME_SETTINGS = 'SET_GAME_SETTINGS';
export const SET_PROFILE = 'SET_PROFILE';
export const ADD_PLAYER_PROFILE = 'ADD_PLAYER_PROFILE';
export const SET_PLAYER_PROFILES = 'SET_PLAYER_PROFILES';

/**
 * Handle setting up everything once the database is ready to use.
 * @param state {Object} The current state of the application, used to populate the database
 * @returns {Function}
 */
export function databaseReady(state) {
  return function(dispatch) {
    // Save the state into the database
    dispatch(populateDatabase(state));

    // Load the data from the database and store it in the state
    dispatch(loadFromDb(state.allyCode));

    // Clean up any excess data in the state from previous versions
    dispatch(cleanState());
  };
}

/**
 * If the "profiles" key exists in the state, then populate the database with anything in it.
 * If the "characters" key exists in the state, populate gameSettings for each character that has one.
 * @param state {Object}
 */
export function populateDatabase(state) {
  return function(dispatch) {
    const db = getDatabase();

    // First, check to see if there's anything in the state that we need to load into the database
    if (state.profiles) {
      const profiles = Object.values(state.profiles).map(profile => {
        const characters = mapObject(profile.characters, character => {
          const storedCharacter = Object.assign({}, character.serialize());
          delete storedCharacter.gameSettings;
          delete storedCharacter.defaultSettings;

          return storedCharacter;
        });
        return profile.resetPreviousSettings().withCharacters(characters)
      });
      const lastRuns = Object.values(state.profiles)
        .filter(profile => Object.values(profile.previousSettings).length > 0)
        .map(profile => new OptimizerRun(
          profile.allyCode,
          profile.previousSettings.characters,
          profile.previousSettings.mods,
          profile.previousSettings.selectedCharacters,
          profile.previousSettings.modChangeThreshold
        ));
      db.saveProfiles(profiles, nothing, error =>
        dispatch(showFlash(
          'Storage Error',
          'Error saving your profile: ' + error.message + ' Your progress is not saved.'
        ))
      );
      db.saveLastRuns(lastRuns, nothing, error =>
        dispatch(showFlash(
          'Storage Error',
          'Error saving previous runs: ' +
          error.message +
          ' The optimizer will need to recalculate optimized values on the next run.'
        ))
      );
    }

    if (state.characters) {
      const gameSettings = Object.values(state.characters)
        .map(character => character.gameSettings)
        .filter(x => null !== x);

      db.saveGameSettings(gameSettings, nothing, error =>
        dispatch(showFlash(
          'Storage Error',
          'Error saving base character settings: ' +
          error.message +
          ' The optimizer may not function properly for all characters'
        ))
      );
    }

  };
}

/**
 * Read Game settings and player profiles from the database and load them into the app state
 * @param allyCode
 * @returns {Function}
 */
export function loadFromDb(allyCode) {
  return function(dispatch) {
    dispatch(loadGameSettings());
    dispatch(loadProfiles(allyCode));
  };
}

/**
 * Load game settings from the database and store them in the state
 * @returns {Function}
 */
function loadGameSettings() {
  return function(dispatch) {
    const db = getDatabase();

    db.getGameSettings(
      gameSettings => {
        const gameSettingsObject = groupByKey(gameSettings, gameSettings => gameSettings.baseID);
        dispatch(setGameSettings(gameSettingsObject));
      },
      error =>
        dispatch(showFlash(
          'Storage Error',
          'Error reading basic character settings: ' +
          error.message +
          ' The settings will be restored when you next fetch data.'
        ))
    );
  }
}

/**
 * Load profiles from the database and store them in the state. Only keep the full profile for the current active
 * ally code. All others only keep the ally code and name
 * @param allyCode
 * @returns {Function}
 */
export function loadProfiles(allyCode) {
  return function(dispatch) {
    const db = getDatabase();

    db.getProfiles(
      profiles => {
        // Set the active profile
        const profile = allyCode ?
          profiles.find(profile => profile.allyCode === allyCode) :
          profiles.find((profile, index) => index === 0);
        dispatch(setProfile(profile));

        // Set up the playerProfiles object used to switch between available profiles
        const playerProfiles = {};
        profiles.forEach(profile => playerProfiles[profile.allyCode] = profile.playerName);
        dispatch(setPlayerProfiles(playerProfiles));
      },
      error =>
        dispatch(showFlash(
          'Storage Error',
          'Error retrieving profiles: ' + error.message
        ))
    );
  };
}

/**
 * Remove any of the old keys from the state that are no longer needed with the database
 * @returns {{type: string}}
 */
export function cleanState() {
  return {
    type: CLEAN_STATE
  };
}

/**
 * Load a single player profile from the database and set it in the state
 * @param allyCode {string}
 * @returns {*}
 */
export function loadProfile(allyCode) {
  if (!allyCode) {
    return nothing;
  }

  return function(dispatch) {
    const db = getDatabase();
    db.getProfile(
      allyCode,
      profile => dispatch(setProfile(profile)),
      error => dispatch(showError('Error loading your profile from the database: ' + error.message))
    );
  };
}

/**
 * Export all of the data in the database
 * @param callback {function(Object)}
 * @returns {Function}
 */
export function exportDatabase(callback) {
  return function(dispatch) {
    const db = getDatabase();
    db.export(
      callback,
      error => dispatch(showError('Error fetching data from the database: ' + error.message))
    );
  };
}

/**
 * Add new GameSettings objects to the database, or update existing ones
 * @param gameSettings {Array<GameSettings>}
 */
export function saveGameSettings(gameSettings) {
  return function(dispatch) {
    const db = getDatabase();
    db.saveGameSettings(
      gameSettings,
      () => dispatch(loadGameSettings()),
      error => dispatch(showFlash(
        'Storage Error',
        'Error saving basic character settings: ' +
        error.message +
        ' The settings will be restored when you next fetch data.'
      ))
    );
  };
}

/**
 * Add new Profiles to the database, or update existing ones.
 * @param profiles {Array<PlayerProfile>}
 * @param allyCode {string}
 * @returns {Function}
 */
export function saveProfiles(profiles, allyCode) {
  return function(dispatch) {
    const db = getDatabase();
    db.saveProfiles(
      profiles,
      () => dispatch(loadProfiles(allyCode)),
      error => dispatch(showError(
        'Error saving player profiles: ' + error.message
      ))
    );
  };
}

/**
 * Add new Optimizer Runs to the database, or update existing ones.
 * @param lastRuns {Array<OptimizerRun>}
 * @returns {Function}
 */
export function saveLastRuns(lastRuns) {
  return function(dispatch) {
    const db = getDatabase();
    db.saveLastRuns(
      lastRuns,
      nothing,
      error => dispatch(showError(
        'Error saving previous runs: ' + error.message +
        ' The optimizer may not recalculate all toons properly until you fetch data again.'
      ))
    );
  };
}

export function setGameSettings(gameSettings) {
  return {
    type: SET_GAME_SETTINGS,
    gameSettings: gameSettings
  };
}

export function setProfile(profile) {
  return {
    type: SET_PROFILE,
    profile: profile
  };
}

/**
 * Add a profile to the state's list of player profiles
 * @param profile {PlayerProfile}
 */
export function addPlayerProfile(profile) {
  return {
    type: ADD_PLAYER_PROFILE,
    profile: profile
  };
}

export function setPlayerProfiles(profiles) {
  return {
    type: SET_PLAYER_PROFILES,
    profiles: profiles
  };
}
