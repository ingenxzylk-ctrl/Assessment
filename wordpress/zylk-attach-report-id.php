<?php
/**
 * Plugin Name: Zylk quiz Report ID on Woo orders
 * Description: Copies ?zylk_report=TR-… from checkout-link into order meta _zylk_report_id so the quiz API can mark Purchased=Yes.
 */
if (!defined('ABSPATH')) {
  exit;
}

add_action('init', function () {
  if (empty($_GET['zylk_report'])) {
    return;
  }
  $report = sanitize_text_field(wp_unslash($_GET['zylk_report']));
  if (!preg_match('/^TR-\d{8}-\d+(?:-DUP\d+)?$/i', $report)) {
    return;
  }
  if (function_exists('WC') && WC()->session) {
    WC()->session->set('zylk_report', strtoupper($report));
  }
  if (!headers_sent()) {
    setcookie('zylk_report', strtoupper($report), time() + 86400, COOKIEPATH ?: '/', COOKIE_DOMAIN, is_ssl(), true);
  }
}, 5);

add_action('woocommerce_checkout_create_order', function ($order) {
  $report = '';
  if (function_exists('WC') && WC()->session) {
    $report = (string) WC()->session->get('zylk_report');
  }
  if (!$report && !empty($_COOKIE['zylk_report'])) {
    $report = sanitize_text_field(wp_unslash($_COOKIE['zylk_report']));
  }
  if ($report && preg_match('/^TR-\d{8}-\d+(?:-DUP\d+)?$/i', $report)) {
    $order->update_meta_data('_zylk_report_id', strtoupper($report));
  }
}, 20, 1);
