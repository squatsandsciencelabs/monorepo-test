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
import {
    createAction,
    createReducer,
    ActionReducerMapBuilder,
} from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';

import { ORM } from 'redux-orm';
import { OrmSession } from 'redux-orm/Session';

////////////////////////////////////////
// LOGIC FOR SLICES AND INITIAL STATE //
////////////////////////////////////////

type ReducerSliceHandler<State> = (builder: ActionReducerMapBuilder<State>) => ActionReducerMapBuilder<State>

export interface ReducerSlice<State> {
    readonly reducerKey: string;
    readonly handler: ReducerSliceHandler<State>;
}

export interface ReducerInitialState {
    readonly reducerKey: string;
    readonly state: any;
}

type ReducerDictionary = {[reducerKey: string]: Reducer};

// for non orm functions
// generates a dictionary of reducers
// can be called directly by combineReducers
export function combineReducerSlices(slices: ReducerSlice<any>[], initialStates: ReducerInitialState[]): ReducerDictionary {
    // process initial states
    const initialStateDictionary: { [reducerKey: string]: any} = {}; // lookup for initial states
    for (const initialState of initialStates) {
        const reducerKey = initialState.reducerKey;

        if (!initialStateDictionary[reducerKey]) {
            // new state
            initialStateDictionary[reducerKey] = initialState.state;
        } else {
            // exists, combine the states
            initialStateDictionary[reducerKey] = {
                ...initialStateDictionary[reducerKey],
                ...initialState.state,
            };
        }

    }

    // process slices by key into a dictionary
    const sliceDictionary: { [reducerKey: string]: ReducerSliceHandler<any>[]} = {};
    for (const slice of slices) {
        const reducerKey = slice.reducerKey;
        if (!sliceDictionary[reducerKey]) {
            sliceDictionary[reducerKey] = [slice.handler];
        } else {
            sliceDictionary[reducerKey].push(slice.handler);
        }
    }

    // create reducers
    const result: ReducerDictionary = {};
    for (const [key, array] of Object.entries(sliceDictionary)) {
        result[key] = createReducer(initialStates[key], (builder) => {
            for (const handler of array) {
                builder = handler(builder);
            }
        });
    }

    return result;
}

///////////////////////////////////////////
// EXAMPLE USAGE OF HANDLERS AND ACTIONS //
///////////////////////////////////////////


// state of reducer for this particular bucket, reducer can have extended state from other reducers
export interface sliceReducerInterface {
    text: string;
}

// here is the initial state, optional of course, just at least 1 feature bucket should dfeine it
export const initialState: ReducerInitialState = {
    reducerKey: 'foobar',
    state: {
        text: 'idk'
    }
};

// here is an action that the reducer calls
export const sliceActionTest = createAction("CREATE_SOMETHING", function prepare(text: string, something: number) {
    return {
        payload: {
            text,
            createdAt: new Date().toISOString()
        }
    };
});

// here is a reducer slice with a handler
export const sliceTest: ReducerSlice<sliceReducerInterface> = {
    reducerKey: 'foobar',
    handler: (builder) => {
        return builder.addCase(sliceActionTest, (state, action) => {
            state.text = action.payload.text;
        });
    }
};

///////////////////////////////////
// EXAMPLE USAGE OF CREATE SLICE //
///////////////////////////////////

// this can then be sent to combineReducers
const result = combineReducerSlices([sliceTest], [initialState]);


/*
//////////////////////////
// LOGIC FOR ORM SLICES //
//////////////////////////

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
*/

// NOTE: OLD LOGIC, deprecated in favor of RTK
/*
    // for (const slice of slices) {
    //     const reducerKey = slice.reducerKey;

    //     // generate initial dictionary for that reducer key
    //     if (!actionHandlersDictionary[reducerKey]) {
    //         actionHandlersDictionary[reducerKey] = {};
    //     }

    //     // error out if duplicate action
    //     if (actionHandlersDictionary[reducerKey][slice.actionType]) {
    //         throw `Reducer with key ${reducerKey} has duplicate action callbacks for action ${slice.actionType}`;
    //     }

    //     // save reducer function to that reducer key + action combination
    //     actionHandlersDictionary[reducerKey][slice.actionType] = slice.actionHandler;
    // }

    // generate
    // for (const reducerKey in actionHandlersDictionary) {
    //     const initialState = initialStateDictionary[reducerKey];
    //     reducerDictionary[reducerKey] = function(state, action) {
    //         // set the initial state
    //         let nextState = state;
    //         if (!nextState && initialState) {
    //             nextState = initialState;
    //         }

    //         if (actionHandlersDictionary[reducerKey][action.type]) {
    //             // use action handler
    //             return actionHandlersDictionary[reducerKey][action.type](nextState, action);
    //         } else {
    //             // no logic found for that reducer + action type
    //             return nextState;
    //         }
    //     };
    // }

    // // return the function
    // return reducerDictionary;
*/




// NOTE: These were some experiments I did

//   const fetchUserById = createAsyncThunk(
//     'users/fetchByIdStatus',
//     async (userId, thunkAPI) => {
//         thunkAPI.getState
//     }
//   )


// export function foobar<DefaultParams, PassedInParams>(type: string, defaults: DefaultParams, prepare: Function) {
//     const returnFunction = function(params: PassedInParams) {
//         const result = {
//             ...defaults,
//             ...params,
//             type,
//         };
//         prepare(result);
//         return result;
//     }
//     returnFunction.type = type;
//     returnFunction.toString = () => `${type}`;
//     // TODO: match function?
//     return returnFunction;
// }

// interface MyDefaults {
//     hello: string;
// }
// interface MyParams {
//     entryId: string;
// }

// const action = foobar<MyDefaults, MyParams>('NOTHING_SUCCEEDED', {hello: 'world'});
// const result = action({entryId: 'soemthing5'});

// export function createAction<Keys, Payload>() {

// };
// createAction.prototype.type