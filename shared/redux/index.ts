import { Reducer, Action, AnyAction } from 'redux';
import {
    createAction,
    createReducer,
    ActionReducerMapBuilder,
    CaseReducer,
    PrepareAction,
    PayloadActionCreator,
    ActionCreatorWithPreparedPayload,
} from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';

import { ORM, ModelType } from 'redux-orm';
import { OrmSession } from 'redux-orm/Session';
import AthletesModel from '../models/athletes';

////////////////////////////////////////
// LOGIC FOR SLICES AND INITIAL STATE //
////////////////////////////////////////

// duplicated from redux toolkit as it does not expose the action matcher
interface ActionMatcher<A extends AnyAction> {
    (action: AnyAction): action is A;
}

// saves builder params
// done this way to get around redux toolkit limitation that cases must be executed before matchers
interface AddCaseParams<ActionCreator extends TypedActionCreator<string>> {
    actionCreator: ActionCreator;
    callback: CaseReducer<ReturnType<ActionCreator>>;
}
interface AddMatcherParams<A extends AnyAction> {
    matcher: ActionMatcher<A> | ((action: AnyAction) => boolean);
    reducer: CaseReducer<any, A>;
}

type SliceBuilder<State> = (builder: ActionReducerMapBuilder<State>) => void;

export interface ReducerSlice<State> {
    readonly reducerKey: string;
    readonly builder: SliceBuilder<State>;
}

export interface ReducerInitialState<State> {
    readonly reducerKey: string;
    readonly state: State;
}

type ReducerDictionary = {[reducerKey: string]: Reducer};

// for non orm functions
// generates a dictionary of reducers
// output can be sent directly by combineReducers
export function combineReducerSlices(slices: ReducerSlice<any>[], initialStates: ReducerInitialState<any>[]): ReducerDictionary {
    ////////////////////////////////////
    // STEP 1: process initial states //
    ////////////////////////////////////
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

    ////////////////////////////////////////
    // STEP 2: DEFINE THE BUILDER WRAPPER //
    // Saves the params into dictionaries //
    ////////////////////////////////////////
    const addCaseDictionary: { [reducerKey: string]: AddCaseParams<any>[] } = {};
    const addMatcherDictionary: { [reducerKey: string]: AddMatcherParams<any>[] } = {};
    let reducerKey = '';
    const builder: ActionReducerMapBuilder<any> = {
        addCase<ActionCreator extends TypedActionCreator<string>>(
            actionCreator: ActionCreator,
            callback: CaseReducer<ReturnType<ActionCreator>>) {
                if (!addCaseDictionary[reducerKey]) {
                    addCaseDictionary[reducerKey] = [{ actionCreator, callback }];
                } else {
                    addCaseDictionary[reducerKey].push({ actionCreator, callback });
                }
                return builder;
            },
        addMatcher<A extends AnyAction>(
            matcher: ActionMatcher<A> | ((action: AnyAction) => boolean),
            reducer: CaseReducer<any, A>): Omit<ActionReducerMapBuilder<any>, 'addCase'> {
                if (!addMatcherDictionary[reducerKey]) {
                    addMatcherDictionary[reducerKey] = [{ matcher, reducer }];
                } else {
                    addMatcherDictionary[reducerKey].push({ matcher, reducer });
                }
                return builder;
            },
        addDefaultCase(reducer: CaseReducer<any, AnyAction>) {
            // TODO: implement this
            return builder;
        }
    };


    /////////////////////////////////
    // STEP 3: process case slices //
    /////////////////////////////////
    for (const slice of slices) {
        reducerKey = slice.reducerKey; // set the key, which tells builder where to add it to
        slice.builder(builder);
    }

    ///////////////////////////////////////////////////////////////////////
    // STEP 4: create reducers with either just case, or case + matchers //
    ///////////////////////////////////////////////////////////////////////
    const result: ReducerDictionary = {};
    for (const [key, array] of Object.entries(addCaseDictionary)) {
        result[key] = createReducer(initialStates[key], (builder) => {
            // add cases
            for (const params of array) {
                builder.addCase(params.actionCreator, params.callback);
            }

            // add matchers if exists
            if (addMatcherDictionary[key]) {
                for (const params of addMatcherDictionary[key]) {
                    builder.addMatcher(params.matcher, params.reducer);
                }
            }
        });
    }

    //////////////////////////////////////////////////////
    // STEP 5: create reducers which just have matchers //
    //////////////////////////////////////////////////////
    for (const [key, array] of Object.entries(addMatcherDictionary)) {
        // already exists check, which means it had case + matcher already
        if (result[key]) {
            continue;
        }

        // add matcher only reducer
        result[key] = createReducer(initialStates[key], (builder) => {
            for (const params of array) {
                builder.addMatcher(params.matcher, params.reducer);
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
export const initialState: ReducerInitialState<MyFeatureSliceReducer> = {
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
    builder: (builder) => {
        builder.addCase(myFeatureAction, (state, action) => {
            state.text = action.payload.text;
        });
        builder.addMatcher((action) => {
            if (action.payload.hello) {
                return true;
            }
            return false;
        }, (state, action) => {
            state.text = action.payload.hello;
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

// this is copied from redux toolkit as the toolkit does not expose this interface
interface TypedActionCreator<Type extends string> {
    (...args: any[]): Action<Type>;
    type: Type;
}

// the reducer here does not get immer but rather an orm session
type ORMReducer<A extends Action = AnyAction> = (session: OrmSession<any>, action: A) => void;

// this is a modified version of the builder in redux toolkit
type ORMReducerBuilder = { addCase<ActionCreator extends TypedActionCreator<string>>(actionCreator: ActionCreator, callback: ORMReducer<ReturnType<ActionCreator>>): void; }

// NOTE: the orm slice does NOT need a reducer key
// this is since unlike general reducer logic above, orm logic typically all goes into a single reducer slice
// the except is something like draft_orm, in which case I can differentiate from ormReducers.ts with draftOrmReducers.ts without issue
type ORMReducerSlice = (builder: ORMReducerBuilder) => void;

export const combineORMSlices = (orm: ORM<any, any>, ormReducerSlices: ORMReducerSlice[]) => {
    // dictionary
    const dictionary: { [actionType: string]: ORMReducer<any>[] } = {};
    
    // create builder
    const builder: ORMReducerBuilder = {
        // only addCase is supported for now, can modify to match what redux toolkit does moving forward as needed
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
        slice(builder);
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

const ormSliceTest: ORMReducerSlice = (builder) => {
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





// ACTION WRAPPER TESTS //

// export declare function createAction<PA extends PrepareAction<any>, T extends string = string>(type: T, prepareAction: PA): PayloadActionCreator<ReturnType<PA>['payload'], T, PA>;

export function createQueuedAction<PA extends PrepareAction<any>, T extends string = string>(type: T, prepareAction: PA) {
    // set the _ATTEMPT type
    type AttemptType = `${T}_ATTEMPT`;
    const attemptType = `${type}_ATTEMPT`;

    type ResultType = ReturnType<PA>["payload"] & { queueType: AttemptType }
    const prepareWrapper = (...args: any[]) => {
        const result = prepareAction(...args);
        result.payload.queueType = attemptType;
        return result as ResultType;
    };

    // @ts-ignore - ignoring the error here as I can't figure out how to make `${T}_ATTEMPT` equal `${type}_ATTEMPT`
    const attemptAction = createAction<PA, AttemptType>(attemptType, prepareAction);

    const origAction: ActionCreatorWithPreparedPayload<Parameters<PA>, ResultType, T> = createAction<PrepareAction<ResultType>, T>(type, prepareWrapper);
    let resultOptional: typeof origAction & { attemptAction?: typeof attemptAction } = origAction;
    resultOptional.attemptAction = attemptAction;
    return resultOptional as typeof origAction & { attemptAction: typeof attemptAction };
}

const actionTest = createQueuedAction('FETCH_GROUPS', (hello: string) => {
    return {
        payload: {
            hello,
            foo: 'bar',
        }
    };
});

const actionTestResult = actionTest('foobar');
actionTestResult.payload.queueType;
actionTestResult.payload.hello;

const attemptActionTest = actionTest.attemptAction('foobar');
attemptActionTest.payload.foo;
attemptActionTest.payload.hello;
