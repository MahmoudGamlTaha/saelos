import * as types from './action-types';
import User from "../User";

const initialState = {
  data: [],
  meta: {
    currentPage: 0,
    from: 0,
    lastPage: 0,
    path: '',
    perPage: 0,
    to: 0,
    total: 0,
  },
  isFetching: false,
  isPosting: false,
  error: false,
  searchString: ''
}

export default function userReducer(state = initialState, action) {
  switch (action.type) {
    case types.FETCHING_USERS:
      return {
        ...state,
        isFetching: true,
        searchString: action.data.searchString
      }
    case types.FETCHING_SINGLE_USER:
      return {
        ...state,
        isFetching: true
      }
    case types.FETCHING_USERS_SUCCESS:
      let { data, meta } = action.data
      let newUsersForState

      if (data.length === 0) {
        return {
          ...state,
          isFetching: false
        }
      }

      // When fetching the first page, always replace the contacts in the app state
      if (meta.current_page === 1) {
        newUsersForState = data
      } else {
        newUsersForState = state.data

        data.map(c => {
          newUsersForState = injectUserIntoState(c, newUsersForState)
        })
      }

      return {
        ...state,
        data: newUsersForState,
        meta: meta,
        isFetching: false,
        error: false
      }
    case types.FETCHING_SINGLE_USER_FAILURE:
    case types.FETCHING_USERS_FAILURE:
      return {
        ...state,
        isFetching: false,
        error: true
      }
    case types.POSTING_USER:
      return {
        ...state,
        isPosting: true
      }
    case types.POSTING_USER_SUCCESS:
    case types.FETCHING_SINGLE_USER_SUCCESS:
      const newData = injectUserIntoState(action.data, state.data)

      return {
        ...state,
        data: newData,
        isFetching: false,
        error: false,
        isPosting: false
      }
    case types.CREATING_USER_VIEW_SUCCESS:


      return {
        ...state
      }
    default:
      return state
  }
}

const injectUserIntoState = (user, data) => {
  const index = _.findIndex(data, (u) => u.id === parseInt(user.id))

  if (index >= 0) {
    data[index] = user
  } else {
    data.push(user)
  }

  return data
}

export const getUsers = (state) => state.data.map(u => new User(u))
export const getUser = (state, id) => {
  let user = _.find(getUsers(state), (u) => u.id === parseInt(id));

  if (typeof user === 'undefined') {
    return new User({})
  }

  return user;
}
export const getSearchStringForUsers = (state) => state.searchString;
export const getPaginationForUsers = (state) => state.meta;