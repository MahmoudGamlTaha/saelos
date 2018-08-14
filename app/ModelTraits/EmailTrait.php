<?php

namespace App\ModelTraits;

use App\Exceptions\MissingSettingException;
use Webklex\IMAP\Client;

trait EmailTrait
{
    /**
     * @var Client
     */
    protected $imapClient;

    protected $watchedFolder;

    protected function getImapClient()
    {
        if ($this->imapClient instanceof Client) {
            return $this->imapClient;
        }

        $settings = $this->getSettings();

        if (! $settings->has('imap_host', 'imap_username', 'imap_password')) {
            throw new MissingSettingException('imap');
        }

        $this->watchedFolder = $settings->get('imap_folder', 'INBOX');
        $this->imapClient = new Client([
            'host' => $settings->get('imap_host'),
            'port' => $settings->get('imap_port', 993),
            'encryption' => $settings->get('imap_encryption', 'ssl'),
            'validate_cert' => $settings->get('imap_validate_cert', true),
            'username' => $settings->get('imap_username'),
            'password' => $settings->get('imap_password'),
            'protocol' => 'imap',
        ]);

        $this->imapClient->connect();

        return $this->imapClient;
    }

    public function getFolders($hierarchical = true, $parentFolder = null)
    {
        return $this->getImapClient()->getFolders($hierarchical, $parentFolder);
    }

    public function getFolderNames()
    {
        return $this->getFolders(false)->pluck('fullName');
    }

    public function getFolder($name)
    {
        return $this->getImapClient()->getFolder($name);
    }

    public function inbox()
    {
        return $this->getFolder('INBOX');
    }

    public function watchedFolder()
    {
        return $this->getFolder($this->watchedFolder);
    }
}