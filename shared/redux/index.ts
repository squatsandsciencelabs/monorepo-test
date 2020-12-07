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

import { Reducer, Action, AnyAction } from 'redux';
import {
    createAction,
    createReducer,
    ActionReducerMapBuilder,
    PayloadAction,
    PayloadActionCreator,
    TypedActionCreator,
} from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';

import { ORM, ModelType } from 'redux-orm';
import { OrmSession } from 'redux-orm/Session';

////////////////////////////////////////
// LOGIC FOR SLICES AND INITIAL STATE //
////////////////////////////////////////

type ReducerSliceHandler<State> = (builder: ActionReducerMapBuilder<State>) => void;

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
                handler(builder);
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
        builder.addCase(sliceActionTest, (state, action) => {
            state.text = action.payload.text;
        });
    }
};

///////////////////////////////////
// EXAMPLE USAGE OF CREATE SLICE //
///////////////////////////////////

// this can then be sent to combineReducers
const result = combineReducerSlices([sliceTest], [initialState]);



//////////////////////////
// LOGIC FOR ORM SLICES //
//////////////////////////

type ORMReducer<A extends Action = AnyAction> = (session: OrmSession<any>, action: A) => void;

type ORMReducerBuilder = { addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, callback: ORMReducer<ReturnType<ActionCreator>>): void; }

type ORMReducerSliceHandler = (builder: ORMReducerBuilder) => void;

export interface ORMReducerSlice {
    readonly actionType: string;
    readonly handler: ORMReducerSliceHandler;
}

export const combineORMSlices = (orm: ORM<any, any>, ormReducerSlices: ORMReducerSlice[]) => {
    // dictionary
    const dictionary: { [actionType: string]: ORMReducer[] } = {};
    
    // create builder
    const builder: ORMReducerBuilder = {
        addCase<ActionCreator extends TypedActionCreator<string>>(
            actionCreator: ActionCreator,
            callback: ORMReducer<ReturnType<ActionCreator>>) {
                const key = actionCreator.type;
                if (!dictionary[key]) {
                    dictionary[key] = [callback];
                } else {
                    dictionary[key].push(callback);
                }
            }
    };

    // pass builder to functions which should add stuff to dictionary
    for (const slice of ormReducerSlices) {
        slice.handler(builder);
    }
    
    // return function
    return (state, action) => {
        const session = orm.mutableSession(state);
        if (dictionary[action.type]) {
            for (const ormReducer of dictionary[action.type]) {
                ormReducer(session, action);
            }
        }
        return session.state;
    };
}

///////////////////////////////////////////
// EXAMPLE USAGE OF HANDLERS AND ACTIONS //
///////////////////////////////////////////

const ormSliceTest: ORMReducerSlice = {
    actionType: sliceActionTest.type,
    handler: (builder) => {
        builder.addCase(sliceActionTest, (session, action) => {
            // Session cannot be known at compile time, only runtime, as it's on a per project basis
            // As a result, it's up to developer to properly cast the model like so
            // Note that this is the same way it's currently handled in sagas
            // const Athletes: ModelType<AthletesModel> = session.Athletes;

            // Typescript is working here
            action.payload.text;

            // redux-orm needs Models defined as AnyType is set to never, but in theory should be perfectly functional
            // Blocks.create({
            //     foobar: action.payload.text,
            // })
        });
    },
};

/////////////////////////////////////////
// EXAMPLE USAGE OF COMBINE ORM SLICES //
/////////////////////////////////////////

// note: should pass in the actual orm object here
// I didn't make redux-orm models for this test project yet so just dumping in null for now
const ormResult = combineORMSlices(null, [ormSliceTest]);

