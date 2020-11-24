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

import { Reducer } from 'redux';

export interface ReducerSlice {
    readonly reducerKey: string;
    readonly actionKey: string;
    readonly actionHandler: Reducer;
}

export interface ReducerInitialState {
    readonly reducerKey: string;
    readonly state: any;
}

// function should take in ALL of the above entirely
// function should either call combine reducers, OR return a dictionary that can be used by combine reducers
export function combineReducerSlices(slices: ReducerSlice[], initialStates: ReducerInitialState[]) {
    const reducerDictionary: { [reducerKey: string]: Reducer} = {}; // what gets returned by this function
    const actionHandlersDictionary: { [reducerKey: string]: { [actionKey: string]: Reducer}} = {}; // lookup for each generated function
    const initialStateDictionary: { [reducerKey: string]: any} = {}; // lookup for initial states

    // process slices
    for (const slice of slices) {
        const reducerKey = slice.reducerKey;

        // generate initial dictionary for that reducer key
        if (!actionHandlersDictionary[reducerKey]) {
            actionHandlersDictionary[reducerKey] = {};
        }

        // error out if duplicate action
        if (actionHandlersDictionary[reducerKey][slice.actionKey]) {
            throw `Reducer with key ${reducerKey} has duplicate action callbacks for action ${slice.actionKey}`;
        }

        // save reducer function to that reducer key + action combination
        actionHandlersDictionary[reducerKey][slice.actionKey] = slice.actionHandler;
    }

    // process initial states
    for (const initialState of initialStates) {
        const reducerKey = initialState.reducerKey;

        if (initialStateDictionary[reducerKey]) {
            throw `Reduce with key ${reducerKey} has duplicate initial state`;
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

// export interface ORMReducerSlice {
//     readonly reducerKey: string;
//     readonly actionKey: string;
//     readonly actionHandler: ();
// }

// function combineORMSlices(ormReducerSlicers: ORMReducerSlice[]) {

// }