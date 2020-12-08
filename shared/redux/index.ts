import { Reducer, Action, AnyAction } from 'redux';
import {
    createAction,
    createReducer,
    ActionReducerMapBuilder,
    TypedActionCreator,
} from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';

import { ORM, ModelType } from 'redux-orm';
import { OrmSession } from 'redux-orm/Session';
import AthletesModel from '../models/athletes';

////////////////////////////////////////
// LOGIC FOR SLICES AND INITIAL STATE //
////////////////////////////////////////

type ReducerSliceFactory<State> = (builder: ActionReducerMapBuilder<State>) => void;

export interface ReducerSlice<State> {
    readonly reducerKey: string;
    readonly factory: ReducerSliceFactory<State>;
}

export interface ReducerInitialState {
    readonly reducerKey: string;
    readonly state: any;
}

type ReducerDictionary = {[reducerKey: string]: Reducer};

// for non orm functions
// generates a dictionary of reducers
// output can be sent directly by combineReducers
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
    const sliceDictionary: { [reducerKey: string]: ReducerSliceFactory<any>[]} = {};
    for (const slice of slices) {
        const reducerKey = slice.reducerKey;
        if (!sliceDictionary[reducerKey]) {
            sliceDictionary[reducerKey] = [slice.factory];
        } else {
            sliceDictionary[reducerKey].push(slice.factory);
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
export interface MyFeatureSliceReducer {
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
export const myFeatureAction = createAction("CREATE_SOMETHING", function prepare(text: string, something: number) {
    return {
        payload: {
            text,
            createdAt: new Date().toISOString()
        }
    };
});

// NOTE: Analytics on actions would be done IN THE PROJECT THEMSELVES through a Thunk that dispatches this action
// This is because:
// 1. a Thunk NEEDS to know the state of the store to function TypeScript wise
// 2. Analytics are project specific, safer to not share it
// So I would create an project wide ThunkAction using the combined state of the store. It would look something like
// export type AppThunk = ThunkAction<?, ?, ?, ?>
// Then the thunk would be like
// export const myWrappedFeatureAction: AppThunk = (text: string, something: number): (dispatch, getState) => {
// const state = getState();
// analytics.log();
// dispatch(myFeatureAction(text, something));
// }

// here is a reducer slice with a handler
export const sliceTest: ReducerSlice<MyFeatureSliceReducer> = {
    reducerKey: 'foobar',
    factory: (builder) => {
        builder.addCase(myFeatureAction, (state, action) => {
            state.text = action.payload.text;
        });
    }
};

///////////////////////////////////
// EXAMPLE USAGE OF CREATE SLICE //
///////////////////////////////////

// this has a dictionary of reducers
// this can then be sent directly to combineReducers
const result = combineReducerSlices([sliceTest], [initialState]);



//////////////////////////
// LOGIC FOR ORM SLICES //
//////////////////////////

type ORMReducer<A extends Action = AnyAction> = (session: OrmSession<any>, action: A) => void;

type ORMReducerBuilder = { addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, callback: ORMReducer<ReturnType<ActionCreator>>): void; }

type ORMReducerSliceFactory = (builder: ORMReducerBuilder) => void;

export interface ORMReducerSlice {
    readonly actionType: string;
    readonly factory: ORMReducerSliceFactory;
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
        slice.factory(builder);
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
    actionType: myFeatureAction.type,
    factory: (builder) => {
        builder.addCase(myFeatureAction, (session, action) => {
            // Session cannot be known at compile time, only runtime, as it's on a per project basis
            // As a result, it's up to developer to properly cast the model like so
            // Note that this is the same way it's currently handled in sagas
            const Athletes: ModelType<AthletesModel> = session.Athletes;
            Athletes.create({
                id: "foobar",
                name: action.payload.text,
            });
        });
    },
};

/////////////////////////////////////////
// EXAMPLE USAGE OF COMBINE ORM SLICES //
/////////////////////////////////////////

// orm would be created by each PROJECT, it is not created within the shared folder
// feature bucket actions and selectors would expose a setORM function that stores it in that module
// always use absolute path (no relative) through use of tsconfig's baseURL to ensure it uses the same instance of the module
// can have a convenience setORM function in the index.js of the feature bucket that calls it for the other modules as well
// this appears to be the best approach as, I NEED the project to create the ORM due to stateSelector needing to be set in the constructor
// and further, I want to allow for the possibility of two orm slices, like how I used draft_orm on the coaching portal
// so I don't want the orm object to be created within the shared library, I need it passed in
// and if it's passed in, it either needs to go thru a generation function or just get set.
// Getting set IMO is simpler than wrapping all your calls in a function that generates the output, and works better w/ typescript too
const orm = new ORM();

// this returns the reducer, can set it to combine reducers to a specific key
const ormResult = combineORMSlices(orm, [ormSliceTest]);
