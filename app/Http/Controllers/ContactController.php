<?php

namespace App\Http\Controllers;

use App\Activity;
use App\CallActivity;
use App\Company;
use App\Contact;
use App\Events\ContactUpdated;
use App\Mail\Contact as ContactMail;
use App\Opportunity;
use App\Http\Resources\Contact as ContactResource;
use App\Http\Resources\ContactCollection;
use App\Http\Requests\StoreContactRequest;
use App\SmsActivity;
use App\User;
use Auth;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Twilio\Rest\Client;
use Twilio\Twiml;

/**
 * @resource Contacts
 * 
 * Interact with Contacts
 */
class ContactController extends Controller
{
    use Exportable;

    const INDEX_WITH = [
        'user',
        'companies',
        'opportunities',
        'opportunities.companies',
        'opportunities.contacts',
        'opportunities.notes',
        'opportunities.notes.user',
        'activities',
        'activities.details',
        'activities.user',
        'activities.contact',
        'activities.company',
        'activities.opportunity',
        'customFields',
        'customFields.field',
        'notes',
        'notes.document',
        'notes.user',
        'status',
        'tags',
    ];

    const SHOW_WITH = [
        'user',
        'companies',
        'opportunities',
        'opportunities.companies',
        'opportunities.contacts',
        'opportunities.notes',
        'opportunities.notes.user',
        'activities',
        'activities.details',
        'activities.user',
        'activities.contact',
        'activities.company',
        'activities.opportunity',
        'customFields',
        'customFields.field',
        'notes',
        'notes.document',
        'notes.user',
        'status',
        'tags',
    ];

    /**
     * Fetching a filtered Contact list.
     * 
     * @param Request $request
     * 
     * @return ContactCollection
     */
    public function index(Request $request)
    {
        $contacts = Contact::with(static::INDEX_WITH);

        if ($searchParams = json_decode($request->get('searchParams'), true)) {
            $contacts = Contact::search($searchParams, $contacts);
        }

        if ($modifiedSince = $request->get('modified_since')) {
            $contacts->where('updated_at', '>', new Carbon($modifiedSince));
        }

        $contacts->orderBy('contacts.id', 'desc');

        if ($request->get('export', false)) {
            return $this->exportQueryBuilder($contacts, Contact::class, Contact::ADDITIONAL_CSV_HEADERS);
        }

        return new ContactCollection($contacts->paginate());
    }

    /**
     * Fetch a single Contact
     * 
     * @param Contact $contact
     * 
     * @return ContactResource
     */
    public function show(Contact $contact)
    {
        return new ContactResource($contact->load(static::SHOW_WITH));
    }

    /**
     * Update an existing Contact.
     * 
     * @param StoreContactRequest $request
     * @param Contact             $contact
     *
     * @TODO: Move company update to Model mutators
     *
     * @return ContactResource
     */
    public function update(StoreContactRequest $request, Contact $contact)
    {
        $data = $request->all();
        $companies = $data['companies'] ?? [];
        $opportunities = $data['opportunities'] ?? [];
        $contactUser = $data['user'] ?? null;
        $customFields = $data['custom_fields'] ?? [];
        $activities = $data['activities'] ?? [];

        $companyIds = [];
        foreach ($companies as $company) {
            $companyIds[$company['id']] = [
                'primary' => $company['pivot']['primary'] ?? 0,
                'position' => $company['pivot']['position'] ?? ''
            ];
        }

        $opportunityIds = [];
        foreach ($opportunities as $opportunity) {
            $opportunityIds[$opportunity['id']] = [
                'primary' => $opportunity['pivot']['primary'] ?? 0,
                'position' => $opportunity['pivot']['position'] ?? ''
            ];
        }

        $user = isset($contactUser['id']) ? User::find($contactUser['id']) : null;

        if (isset($data['user_id']) && is_string($data['user_id']) && !is_numeric($data['user_id'])) {
            $user = User::where('name', $data['user_id'])->first();
            unset($data['user_id']);
        }

        $contact->companies()->sync($companyIds);
        $contact->opportunities()->sync($opportunityIds);

        if ($user) {
            $contact->user()->associate($user);
        }

        $contact->update($data);
        $contact->assignCustomFields($customFields);
        $contact->addActivities($activities);

        event(new ContactUpdated($contact));

        return $this->show($contact);
    }

    /**
     * Save a new Contact
     * 
     * @param StoreContactRequest $request
     *
     * @return ContactResource
     */
    public function store(StoreContactRequest $request)
    {
        $data = $request->all();

        if (isset($data['email'])) {
            $contact = Contact::where('email', '=', $data['email'])->first();
        }

        if (!isset($contact)) {
            unset($data['user_id']);
            $contact = Contact::create($data);
        }

        return $this->update($request, $contact);
    }

    /**
     * Delete a Contact
     * 
     * @param Contact $contact
     *
     * @return string
     */
    public function destroy(Contact $contact)
    {
        $contact->delete();

        return '';
    }

    /**
     * Send an email to a Contact.
     * 
     * @param Request $request
     * @param Contact $contact
     * 
     * @return int
     */
    public function email(Request $request, Contact $contact)
    {
        $email = new ContactMail(
            $request->get('email_content'),
            $request->get('email_subject'),
            $request->get('email_cc', ''),
            $request->get('email_bcc', '')
        );

        Mail::to($contact->email)
            ->send($email);

        return 1;
    }

    /**
     * Send an sms to a Contact.
     * 
     * @TODO: Fix the response to simply return the activity.
     *        Build a server model observor that sends out notification.
     * 
     * @param Request $request
     * @param Contact $contact
     * 
     * @return array
     */
    public function sms(Request $request, Contact $contact)
    {
        $user = Auth::user();
        $user->load(['customFields']);
        $twilioNumberField = $user->customFields()->where('custom_field_alias', 'twilio_number')->first();

        if ($twilioNumberField === null) {
            return response(['success' => false, 'message' => 'User does not have a valid Twilio phone number.']);
        }

        try {
            $client = new Client(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));

            $message = $client->messages->create(
                $contact->phone,
                [
                    'from' => $twilioNumberField->value,
                    'body' => $request->get('message')
                ]
            );

        } catch (\Exception $e) {
            return response(['success' => false, 'message' => $e->getMessage()]);
        }

        $details = SmsActivity::create([
            'uuid' => $message->sid,
            'details' => [],
            'start_date' => new \DateTime,
            'message' => $request->get('message')
        ]);

        $activity = Activity::create([
            'name' => 'SMS Sent',
            'description' => sprintf('%s sent an SMS to %s %s', $user->name, $contact->first_name, $contact->last_name),
            'user_id' => $user->id,
            'details_id' => $details->id,
            'details_type' => SmsActivity::class,
            'completed' => 1
        ]);

        $activity->contact()->attach($contact);

        if ($opportunityId = $request->get('opportunity_id')) {
            $opportunity = Opportunity::find($opportunityId);

            if ($opportunity) {
                $activity->opportunity()->attach($opportunity);
            }
        }

        if ($companyId = $request->get('company_id')) {
            $company = Company::find($companyId);

            if ($company) {
                $activity->company()->attach($company);
            }
        }

        $activity->load(['company', 'contact', 'opportunity', 'details']);

        return response(['success' => true, 'message' => 'SMS Sent', 'activity' => $activity]);
    }

    /**
     * Initiate a call to a Contact.
     * 
     * @TODO: Fix the response to simply return the activity.
     *        Build a server model observor that sends out notification.
     * 
     * @param Request $request
     * @param Contact $contact
     * 
     * @return array
     */
    public function call(Request $request, Contact $contact)
    {
        $user = Auth::user();
        $user->load(['customFields']);
        $twilioNumberField = $user->customFields()->where('custom_field_alias', 'twilio_number')->first();

        if ($twilioNumberField === null) {
            return response(['success' => false, 'message' => 'User does not have a valid Twilio phone number.']);
        }

        try {
            $client = new Client(env('TWILIO_ACCOUNT_SID'), env('TWILIO_AUTH_TOKEN'));

            $call = $client->calls->create(
                $user->phone,
                $twilioNumberField->value,
                [
                    'url' => route('api.contacts.outbound', ['id' => $contact->id, 'user_id' => $user->id])
                ]
            );

        } catch (\Exception $e) {
            return response(['success' => false, 'message' => $e->getMessage()]);
        }

        $details = CallActivity::create([
            'uuid' => $call->sid,
            'details' => [],
            'start_date' => new \DateTime,
        ]);

        $activity = Activity::create([
            'name' => 'Phone call placed',
            'description' => sprintf('%s placed a phone call to %s %s', $user->name, $contact->first_name, $contact->last_name),
            'user_id' => $user->id,
            'details_id' => $details->id,
            'details_type' => CallActivity::class
        ]);

        $activity->contact()->attach($contact);

        if ($opportunityId = $request->get('opportunity_id')) {
            $opportunity = Opportunity::find($opportunityId);

            if ($opportunity) {
                $activity->opportunity()->attach($opportunity);
            }
        }

        if ($companyId = $request->get('company_id')) {
            $company = Company::find($companyId);

            if ($company) {
                $activity->company()->attach($company);
            }
        }

        $activity->load(['company', 'contact', 'opportunity', 'details']);

        return response(['success' => true, 'message' => 'Call initiated', 'activity' => $activity]);
    }

    /**
     * @hideFromAPIDocumentation
     * 
     * @param Request $request
     * @param Contact $contact
     * @param User    $user
     */
    public function outbound(Request $request, Contact $contact, User $user)
    {
        // @TODO: Validate contact phone number

        $twiml = new Twiml();
        $twiml->dial($contact->phone, [
            'record' => 'record-from-answer-dual',
            'recordingStatusCallback' => route('api.contacts.outbound.recording', ['id' => $contact->id])
        ]);

        return response($twiml, 200, [
            'Content-Type' => 'text/xml'
        ]);
    }

    /**
     * @hideFromAPIDocumentation
     */
    public function recording(Request $request, $id)
    {
        $activity = CallActivity::where('uuid', $request->get('CallSid'))->first();

        if ($activity) {
            $activity->update([
                'recording' => $request->get('RecordingUrl')
            ]);

            $activity->activity()->update([
                'completed' => 1
            ]);
        }
    }

    /**
     * Get a count of Contacts.
     * 
     * The count returned represents the number of contacts assigned
     * to the requesting user that are grouped by the given groupBy
     * request parameter.
     * 
     * @TODO: Update response to simply return the count
     * 
     * @param Request $request
     * 
     * @return array
     */
    public function count(Request $request)
    {
        $groupBy = $request->get('groupBy', 'status_id');

        $count = \DB::table('contacts')
            ->select($groupBy, \DB::raw('count(*) as total'))
            ->where('user_id', \Auth::id())
            ->whereNotNull($groupBy)
            ->groupBy($groupBy)
            ->pluck('total', $groupBy);

        return response(['success' => true, 'data' => $count]);
    }
}
