import * as types from "./action-types";
import _ from "lodash";

const initialState = {
  data: [],
  dataUpdated: false,
  dataAppended: false,
  entityId: 0,
  entityType: ""
};

export default function noteReducer(state = initialState, action) {
  switch (action.type) {
    case types.SET_NOTES_FOR_FLYOUT:
      return {
        ...state,
        data: action.data,
        dataUpdated: true,
        dataAppended: false,
        entityId: action.entityId,
        entityType: action.entityType
      };
    case types.CLEAR_NOTES_FOR_FLYOUT:
      return {
        ...state,
        data: [],
        dataUpdated: false,
        dataAppended: false,
        entityId: 0,
        entityType: ""
      };
    case types.APPEND_NOTE_TO_FLYOUT:
      if (
        action.entityId === state.entityId &&
        action.entityType === state.entityType
      ) {
        let newData = state.data.slice(0);

        newData.unshift(action.data);

        return {
          ...state,
          data: newData,
          dataUpdated: true,
          dataAppended: true
        };
      } else {
        return state;
      }
    default:
      return state;
  }
}
