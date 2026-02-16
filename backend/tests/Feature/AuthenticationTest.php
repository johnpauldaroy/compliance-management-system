<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    /**
     * Verify that unauthenticated requests to protected routes return 401 instead of a 500 RouteNotFound error.
     */
    public function test_unauthenticated_api_request_returns_401(): void
    {
        $response = $this->getJson('/api/me');

        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    /**
     * Verify that unauthenticated web requests to the login page return 401.
     */
    public function test_unauthenticated_web_login_returns_401(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }

    /**
     * Verify that the root page is still accessible.
     */
    public function test_root_page_is_accessible(): void
    {
        $response = $this->get('/');

        $response->assertStatus(200);
    }
}
