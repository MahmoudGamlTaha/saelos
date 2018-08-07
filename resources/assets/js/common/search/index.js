import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import * as MDIcons from "react-icons/lib/md";
import { CirclePicker } from "react-color";
import { parseSearchString, parsedToString } from "../../utils/helpers";
import { getActiveUser, getViews } from "../../modules/users/store/selectors";
import { createView, removeView } from "../../modules/users/service";

class AdvancedSearch extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      searchString: props.searchString,
      addingView: false,
      formState: {
        linkText: "",
        color: "",
        parentItem: props.parentItem
      },
      expandSearch: false,
      searchDivScrollLeft: 0,
      activeOnly: "true"
    };

    this.searchInputRef = null;
    this.searchDivRef = null;
  }

  _updateSearchString = string => {
    const { searchString } = this.state;
    const lastChar = searchString.substring(searchString.length - 1);
    const trimmed =
      lastChar === "+"
        ? searchString.substring(0, searchString.length - 1)
        : searchString;
    let newSearchString = `${trimmed}${string}`;

    if (string.trim() === "active:false" || string.trim() === "active:true") {
      const parsed = parseSearchString(trimmed);
      const active = parseSearchString(string);
      const activeIndex = _.findIndex(
        parsed.offsets,
        o => o.keyword === "active"
      );

      if (activeIndex >= 0) {
        parsed.offsets[activeIndex].value = active.offsets[0].value;

        this.setState({
          activeOnly: active.offsets[0].value
        });

        newSearchString = parsedToString(parsed);
      }

      this._submit({ value: newSearchString });
    }

    this.setState({
      searchString: newSearchString,
      expandSearch: false
    });

    this._focusSearchInput();
  };

  _focusSearchInput = () => {
    this.searchInputRef.focus();
    this.searchInputRef.selectionStart = this.searchInputRef.value.length;
    this.searchInputRef.selectionEnd = this.searchInputRef.value.length;
  };

  _handleOnChange = e => {
    this.setState({
      searchString: e.target.value
    });
  };

  _handleInputChange = event => {
    const { target } = event;
    const { value, name } = target;
    const { formState } = this.state;

    _.set(formState, name, value);

    this.setState({
      formState
    });
  };

  _onKeyPress = event => {
    const { target, charCode } = event;
    const { searchString, expandSearch } = this.state;
    const lastChar = searchString.substr(searchString.length - 1);

    if (charCode === 43 && (target.value.length === 0 || lastChar === " ")) {
      // +
      this.setState({
        expandSearch: true
      });
    } else {
      this.setState({
        expandSearch: false
      });
    }

    if (charCode !== 13) {
      return;
    }

    event.preventDefault();

    this._submit(target);
  };

  _submit = input => {
    const { value } = input;
    const { dispatch, searchFunc } = this.props;

    if (value.length >= 3 || /([\uD800-\uDBFF][\uDC00-\uDFFF])/.test(value)) {
      dispatch(searchFunc({ page: 1, searchString: value }));
    } else if (value.length === 0) {
      dispatch(searchFunc({ page: 1, searchString: "" }));
    }
  };

  _buildHtmlFromSearchString = value => {
    if (!value.trim()) {
      return "Search...";
    }

    const { searchFields } = this.props;
    const { originalText, offsets, exclude } = parseSearchString(
      value,
      searchFields
    );

    return typeof offsets === "undefined"
      ? value
      : offsets.map((v, k) => {
          if (v.keyword === "active" && this.state.activeOnly !== v.value) {
            this.setState({
              activeOnly: v.value
            });
          }

          const field = searchFields[v.keyword];
          const excluded = exclude.hasOwnProperty(v.keyword);
          const isField = typeof field !== "undefined";
          const isRelation = [
            "assignee",
            "stage",
            "status",
            "opportunity",
            "company",
            "contact",
            "tag"
          ].includes(v.keyword);
          const hasTag = isRelation || isField;

          if (!hasTag || v.keyword === "freetext") {
            return v.value;
          }

          return (
            <React.Fragment key={k}>
              <span
                className={`highlight-${isRelation ? "relation" : "field"}`}
              >
                {excluded ? "-" : ""}
                {v.keyword}:{v.exact ? `"${v.value}"` : v.value}
              </span>
              &nbsp;
            </React.Fragment>
          );
        });
  };

  _toggleAdd = () => {
    this.setState({
      addingView: !this.state.addingView
    });
  };

  _createView = () => {
    const { dispatch, parentItem } = this.props;
    const { formState, searchString } = this.state;

    _.set(formState, "searchString", searchString);

    dispatch(createView(formState));

    this.setState({
      formState: {
        name: "",
        color: "",
        parentItem
      },
      addingView: false
    });
  };

  _removeView = () => {
    const { dispatch, parentItem } = this.props;
    const { searchString } = this.state;

    dispatch(
      removeView({
        searchString,
        parentItem
      })
    );
  };

  _clearSearch = () => {
    const { dispatch, searchFunc } = this.props;

    this.setState({
      searchString: ""
    });

    dispatch(searchFunc({ page: 1, searchString: "" }));
  };

  _download = () => {
    const { dispatch, searchFunc } = this.props;
    const { searchString } = this.state;

    dispatch(searchFunc({ searchString, export: true }));
  };

  render() {
    const {
      searchString,
      addingView,
      formState,
      expandSearch,
      activeOnly
    } = this.state;
    const { views, searchFields, allowExport } = this.props;
    const viewSearchStrings = views.map(v => v.searchString);

    return (
      <div className="position-relative px-3 pt-4 bg-white border-bottom">
        <div
          className={`select-search-tags position-absolute card p-2 fw-200 ${
            expandSearch ? "" : "d-none"
          }`}
        >
          <div className="search-relationships">
            <h5>{this.context.i18n.t("messages.has")}</h5>
            {[
              "assignee",
              "status",
              "stage",
              "tag",
              "opportunity",
              "contact",
              "company"
            ].map((a, i) => {
              return (
                <span
                  key={i}
                  className="cursor-pointer highlight-relation p-1 m-1 d-inline-block"
                  onClick={() => {
                    this._updateSearchString(`${a}:`);
                  }}
                >
                  {a}
                </span>
              );
            })}
          </div>
          <hr />
          <h5>{this.context.i18n.t("messages.fields")}</h5>
          <div className="search-fields">
            {Object.keys(searchFields).map((a, i) => {
              const f = searchFields[a];

              return !f.searchable ? null : (
                <span
                  key={i}
                  className="cursor-pointer highlight-field p-1 m-1 d-inline-block"
                  onClick={() => {
                    this._updateSearchString(`${f.alias}:`);
                  }}
                >
                  {f.alias}
                </span>
              );
            })}
          </div>
        </div>
        <div
          id="advanced-search-container"
          className={searchString ? "input-group" : ""}
        >
          <input
            ref={searchInput => {
              this.searchInputRef = searchInput;
            }}
            type="search"
            className="form-control"
            autoComplete="off"
            id="search-input"
            placeholder="Search..."
            dir="auto"
            onKeyPress={this._onKeyPress}
            onChange={this._handleOnChange}
            onBlur={() => {
              const lastChar = searchString.substr(searchString.length - 1);

              if (lastChar !== "+") {
                this.setState({
                  expandSearch: false
                });
              }
            }}
            value={searchString}
          />
          <div className="input-group-append">
            {searchString && allowExport ? (
              <button
                className="btn btn-outline border text-muted"
                onClick={this._download}
              >
                <MDIcons.MdBackspace />
              </button>
            ) : null}
            {searchString ? (
              <button
                className="btn btn-outline border text-muted"
                onClick={this._clearSearch}
              >
                <MDIcons.MdClearAll />
              </button>
            ) : null}
            {viewSearchStrings.includes(searchString) ? (
              <button
                className="btn btn-outline border text-danger"
                onClick={this._removeView}
              >
                <MDIcons.MdDelete />
              </button>
            ) : searchString ? (
              <button
                className="btn btn-outline border text-muted"
                onClick={this._toggleAdd}
              >
                <MDIcons.MdAdd />
              </button>
            ) : null}
            {addingView ? (
              <div className="add-tag-container">
                <div className="add-tag-menu dropdown-menu show mt-1 pt-2">
                  <div className="px-2 py-2">
                    <div className="form-group">
                      <label htmlFor="linkText">
                        {this.context.i18n.t("messages.create.view")}
                      </label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        id="linkText"
                        name="linkText"
                        placeholder="View Name"
                        value={formState.linkText}
                        onChange={this._handleInputChange}
                      />
                    </div>
                    <div className="form-group">
                      <CirclePicker
                        color={formState.color}
                        name="tagColor"
                        circleSize={20}
                        circleSpacing={10}
                        onChangeComplete={color => {
                          const event = {
                            target: {
                              name: "color",
                              value: color.hex
                            }
                          };

                          this._handleInputChange(event);
                        }}
                        placeholder={formState.color}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      onClick={this._createView}
                    >
                      {this.context.i18n.t("messages.create")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="micro-text row text-center pt-3 pb-2">
          <div
            className={`cursor-pointer text-${
              activeOnly === "true" ? "dark" : "muted"
            } col`}
            onClick={() => this._updateSearchString(" active:true")}
          >
            <b>{this.context.i18n.t("messages.active")}</b>
          </div>
          <div
            className={`cursor-pointer text-${
              activeOnly === "true" ? "muted" : "dark"
            } col`}
            onClick={() => this._updateSearchString(" active:false")}
          >
            <b>{this.context.i18n.t("messages.inactive")}</b>
          </div>
        </div>
      </div>
    );
  }
}

AdvancedSearch.propTypes = {
  dispatch: PropTypes.func.isRequired,
  searchString: PropTypes.string.isRequired,
  searchFunc: PropTypes.func.isRequired,
  searchFields: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
    .isRequired,
  views: PropTypes.array.isRequired,
  user: PropTypes.object.isRequired,
  parentItem: PropTypes.string.isRequired,
  allowExport: PropTypes.bool
};

AdvancedSearch.contextTypes = {
  i18n: PropTypes.object.isRequired
};

AdvancedSearch.defaultProps = {
  allowExport: false
};

export default connect((state, ownProps) => ({
  views: getViews(state, ownProps.parentItem),
  user: getActiveUser(state)
}))(AdvancedSearch);
