<?php

namespace App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * App\Stage
 *
 * @property-read \Illuminate\Database\Eloquent\Collection|\App\Opportunity[] $opportunities
 * @mixin \Eloquent
 */
class Stage extends Model
{
    use SoftDeletes;

    protected $guarded = [
        'id',
        'opportunities',
        'userOpportunities',
        'teamOpportunities',
    ];

    protected $dates = [
        'created_at',
        'updated_at',
        'deleted_at',
    ];

    public function opportunities()
    {
        return $this->hasMany(Opportunity::class);
    }

    public function userOpportunities($id = null)
    {
        $user = $id ? User::findOrFail($id) : \Auth::user();

        return $this->opportunities()->where('user_id', '=', $user->id);
    }

    public function teamOpportunities($id = null)
    {
        $user = $id ? User::findOrFail($id) : \Auth::user();

        $relation = $this->opportunities();

        $relation->getQuery()
            ->select('opportunities.*')
            ->join('users', 'opportunities.user_id', '=', 'users.id')
            ->where('users.team_id', '=', $user->team_id);

        return $relation;
    }
}
