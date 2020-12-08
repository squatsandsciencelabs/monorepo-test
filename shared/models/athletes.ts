import { Model, ModelType, fk, many, attr, QuerySet, SessionBoundModel } from 'redux-orm';

export interface AthleteFields {
    readonly id: string;
    readonly name: string;
}

export interface AthleteProperties extends AthleteFields {
//     readonly team: SessionBoundModel<TeamsModel, {}> | null;
//     readonly group: SessionBoundModel<GroupsModel, {}> | null;
//     readonly athlete_sessions: QuerySet<AthleteSessionsModel>;
//     readonly program_schedules: QuerySet<ProgramSchedulesModel>;
//     // TODO: maxes
}

class AthletesModel extends Model<typeof AthletesModel, AthleteProperties> {

    static modelName = 'Athletes' as const;

    static fields = {
        name: attr(),
    };

}

export default AthletesModel;
