import React, { Component } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import {callContact, submitCallScore} from "../../../../../service"
import Contact from "../../../../../Contact"
import * as MDIcons from 'react-icons/lib/md'
import Select from 'react-select'

class CallAction extends Component {
  constructor(props) {
    super(props)

    this._handleInputChange = this._handleInputChange.bind(this)
    this._initCall = this._initCall.bind(this)
    this._updateSentimentScore = this._updateSentimentScore.bind(this)
    this._submitScore = this._submitScore.bind(this)

    this.state = {
      formState: {
        id: props.contact.id,
        sentiment_score: null,
        opportunity_id: null,
        company_id: null
      },
      callState: {}
    }
  }

  _handleInputChange(event) {
    const { target } = event
    const { name, value } = target
    const { formState } = this.state

    formState[name] = value

    this.setState({
      formState
    });
  }

  _initCall() {
    this.props.dispatch(callContact(this.state.formState))
      .then(call => {
        this.setState({
          callState: call
        })
      })
  }

  _submitScore() {
    this.props.dispatch(submitCallScore(this.state.callState))
  }

  _updateSentimentScore(event) {
    const { target } = event
    const { value } = target
    const { callState } = this.state

    callState.sentiment_score = value

    this.setState({
      callState
    });
  }

  render() {
    const { contact } = this.props
    const { callState } = this.state

    const opportunityOptions = contact.opportunities.map(o => ({value: o.id, label: o.name}))
    const companyOptions = contact.companies.map(c => ({value: c.id, label: c.name}))

    return (
      <div className="card-body callActionView">
        <div className="row">
          <div className="col fw-100 border-right">
            <button
              className={`btn btn-lg w-100 pb-3 ${callState.id ? 'btn-outline-primary' : 'btn-primary'}`}
              onClick={this._initCall}>
              <span className="h2"><MDIcons.MdLocalPhone /></span>
            </button>
            <button
              className={`mt-2 btn btn-sm w-100 ${callState.id ? 'btn-primary' : 'btn-outline-primary'}`}
              onClick={this._submitScore}>
              <span className="">SCORE</span>
            </button>
          </div>
          <div className="col">
            <p>
              Click the button to the left to initiate a call to this user. Once the call is completed please enter your Rep Sentiment Score below.
            </p>

            <div className="row pt-3">
              <div className={`col col-sm-4 ${callState.id ? '' : 'text-muted'}`}>
                <label htmlFor="repSentiment">Rep Sentiment Score</label>
                <div className="pt-1">
                  <input type="range" min="1" max="10" className="slider" name="repSentiment" onChange={this._updateSentimentScore} defaultValue="0" />
                </div>
              </div>
                {opportunityOptions.length ?
                <div className="col col-sm-4">
                  <label htmlFor="callOpportunity">Opportunity</label>
                  <Select
                    multi={false}
                    value={this.state.formState.opportunity_id}
                    onChange={(value) => {
                      const event = {
                        target: {
                          name: 'opportunity_id',
                          value: value ? value.value : null
                        }
                      }

                      this._handleInputChange(event)
                    }}
                     options={opportunityOptions} />
                </div>
                    : ''}
              
              
                {companyOptions.length ?
                <div className="col col-sm-4">
                  <label htmlFor="callCompany">Company</label>
                  <Select
                    multi={false}
                    value={this.state.formState.company_id}
                    onChange={(value) => {
                      const event = {
                        target: {
                          name: 'company_id',
                          value: value ? value.value : null
                        }
                      }

                      this._handleInputChange(event)
                    }}
                    options={companyOptions} />
                </div>
                  : ''}
            </div>
          </div>
        </div>
      </div>
    )
  }
}

CallAction.propTypes = {
  dispatch: PropTypes.func.isRequired,
  contact: PropTypes.instanceOf(Contact).isRequired,
  activeCall: PropTypes.object
}

export default connect()(CallAction)