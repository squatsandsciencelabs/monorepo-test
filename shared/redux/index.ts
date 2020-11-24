/*
Overall, I do not want to redo combine reducers, aka managing prev and next state.
My functions should return the REDUCERS themselves, not the states, and then someone can call combine reducers w/ it.
Do have to consider how redux-orm should connect with it, as redux-orm needs its own way to generate something
Basically that is another sub layer that generates a function that THIS system will use

Two formats can be

{
  reducerKey: [{
	actionKey,
	stateChangeFunction,
  }]
}

[{
  reducerKey,
  actionKey,
  stateChangeFunction,
}]

I don't know which one I like more. They both work.
I might just go with the second one for now as there's no real advantage to grouping
*/

import { Reducer, AnyAction } from 'redux';
import { ORM } from 'redux-orm';
import { OrmSession } from 'redux-orm/Session';

export interface ReducerSlice {
    readonly reducerKey: string;
    readonly actionType: string;
    readonly actionHandler: Reducer;
}

export interface ReducerInitialState {
    readonly reducerKey: string;
    readonly state: any;
}

type ReducerDictionary = {[reducerKey: string]: Reducer};

// for non orm functions
// generates a dictionary of reducers
// can be called directly by combineReducers
export function combineReducerSlices(slices: ReducerSlice[], initialStates: ReducerInitialState[]): ReducerDictionary {
    const reducerDictionary: ReducerDictionary = {}; // what gets returned by this function
    const actionHandlersDictionary: { [reducerKey: string]: { [actionType: string]: Reducer}} = {}; // lookup for each generated function
    const initialStateDictionary: { [reducerKey: string]: any} = {}; // lookup for initial states

    // process slices
    for (const slice of slices) {
        const reducerKey = slice.reducerKey;

        // generate initial dictionary for that reducer key
        if (!actionHandlersDictionary[reducerKey]) {
            actionHandlersDictionary[reducerKey] = {};
        }

        // error out if duplicate action
        if (actionHandlersDictionary[reducerKey][slice.actionType]) {
            throw `Reducer with key ${reducerKey} has duplicate action callbacks for action ${slice.actionType}`;
        }

        // save reducer function to that reducer key + action combination
        actionHandlersDictionary[reducerKey][slice.actionType] = slice.actionHandler;
    }

    // process initial states
    for (const initialState of initialStates) {
        const reducerKey = initialState.reducerKey;

        if (initialStateDictionary[reducerKey]) {
            throw `Reducer with key ${reducerKey} has duplicate initial state`;
        }

        initialStateDictionary[reducerKey] = initialState.state;
    }

    // generate
    for (const reducerKey in actionHandlersDictionary) {
        const initialState = initialStateDictionary[reducerKey];
        reducerDictionary[reducerKey] = function(state, action) {
            // set the initial state
            let nextState = state;
            if (!nextState && initialState) {
                nextState = initialState;
            }

            if (actionHandlersDictionary[reducerKey][action.type]) {
                // use action handler
                return actionHandlersDictionary[reducerKey][action.type](nextState, action);
            } else {
                // no logic found for that reducer + action type
                return nextState;
            }
        };
    }

    // return the function
    return reducerDictionary;
}

export type ORMActionHandler = (session: OrmSession<any>, action: AnyAction) => void;

export interface ORMReducerSlice {
    readonly actionType: string;
    readonly actionHandler: ORMActionHandler;
}

// generates a single reducer for ORM
// can set this as the property of a key in combine reducers
export function combineORMSlices(orm: ORM<any, any>, ormReducerSlices: ORMReducerSlice[]): Reducer {
    // generate array of slices to dictionary
    const dictionary: { [actionType: string]: ORMActionHandler } = {};
    for (const slice of ormReducerSlices) {
        if (dictionary[slice.actionType]) {
            throw `ORM reducer has duplicate action handler for key ${slice.actionType}`;
        }

        dictionary[slice.actionType] = slice.actionHandler;
    }

    // return function
    return (state, action) => {
        const session = orm.session(state);
        if (dictionary[action.type]) {
            dictionary[action.type](session, action);
        }
        return session.state;
    };
}
