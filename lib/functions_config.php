<?php
/**
 * -----------------------------------------------------------------------------
 * @package     smartVISU
 * @author      Joerg Herrmann
 * @copyright   2014
 * @license     GPL [http://www.gnu.de]
 * -----------------------------------------------------------------------------
 */


class config
{
  private $configuration;
  private $config_file;
  private $isError = true;
  private $isPermitted = false;
  private $isKnown = false;
  private $isDefault = false;
  private $client;

  function __construct($config_file) 
  {
    //$this->configuration = parse_ini_file($config_file, TRUE);
    if (($config_raw = file ($config_file)) === false) return null;
    $this->_parse($config_raw);
    $this->config_file = $config_file;
    $this->isError = false;
    $this->isPermitted = $this->check_permission();
  }

  function _parse($config_raw)
  {
    $section = false;
    foreach ($config_raw as $num=>$line)
    {
      // section
      if (preg_match('/^\s*\[(\S+)\]\s*$/',$line ,$matches))
      {
        $section = $matches[1];
      }
      // key = val
      if (preg_match('/^\s*(.+?)\s*=\s*(true)\s*$/i',$line ,$matches) and $section)
      {
        $this->configuration[$section][$matches[1]] = true;
      }
      elseif (preg_match('/^\s*(.+?)\s*=\s*(false)\s*$/i',$line ,$matches) and $section)
      {
        $this->configuration[$section][$matches[1]] = false;
      }
      elseif (preg_match('/^\s*(.+?)\s*=\s*\'(.*)\'\s*$/i',$line ,$matches) and $section)
      {
        $this->configuration[$section][$matches[1]] = $matches[2];
      }
    }
  }

  function isError ()
  {
    return $this->isError;
  }

  function client_is_permitted()
  {
    return $this->isPermitted;
  }

  function client_is_known()
  {
    return $this->isKnown;
  }

  function check_permission()
  {
    // if not multiuser, client always permitted
    if ($this->configuration['smartVISU']['multiuser'] == false)
    {
      $this->isPermitted = true;
      $this->isKnown = true;
      $this->isDefault = true;
      $this->client = 'default';
      // $this->load_config($this->client);
      return true;
    }
    // TODO check ip range
    if ($this->configuration['smartVISU']['ident_by_ip'] == true)
    {
      // client known ?
      if ($this->configuration['clients'][$_SERVER['REMOTE_ADDR']])
      {
        $this->isPermitted = true;
        $this->isKnown = true;
        $this->client = $this->configuration['clients'][$_SERVER['REMOTE_ADDR']];
        // $this->load_config('client:'.$this->client);
        return true;
      }
      // no, but we'r allowed to create a new one
      elseif ($this->configuration['smartVISU']['auto_add'])
      {
        $this->isPermitted = true;
        $this->client = 'client_'.$_SERVER['REMOTE_ADDR'];
        // $this->load_config($this->client);
        return true;        
      }
      else
      {
        return false;
      }
    }
  }
  
  function load_config()
  {
    if ($this->isKnown === false || $this->isDefault) {
      $client_name = 'default';
    } else {
      $client_name = 'client:'.$this->client;
    }
    foreach ($this->configuration['default'] as $key => $val)
    {
      $v = (isset($this->configuration[$client_name][$key]))?$this->configuration[$client_name][$key]:$val;
      define ("config_$key", $v);
    }
    foreach ($this->configuration[$client_name] as $key => $val)
    {
      if (!defined("config_$key")) define ("config_$key", $val);
    }
    define ('config_version', $this->configuration['smartVISU']['version']);
    define ('config_index', 'index');
    define ('config_cache_dom', true);
    define ('config_transition', 'fade');
    define ('config_delay', '750');
    define ('const_cvsucks', 10); //something with design, unclear what it means ...
    date_default_timezone_set('Europe/Berlin');
    umask(0002);
    return true;
  }
    
  function write_config($request)
  {
    if (!$this->isPermitted) return false;
    if (($fp = @fopen($this->config_file, 'w')) === false) return false;
    // update default setting
    if ($this->isDefault)
    {
      foreach ($request as $key => $val)
      {
        if (isset($this->configuration['default'][$key])) $this->configuration['default'][$key] = $val;
      }
    }
    else
    {      
      if (!$this->isKnown) $this->configuration['clients'][$_SERVER['REMOTE_ADDR']] = $this->client;
      foreach ($request as $key => $val)
      {
        $this->configuration['client:'.$this->client][$key] = $val;
      }
      foreach ($this->configuration['client:'.$this->client] as $key => $val)
      {
        if (isset($this->configuration['default'][$key]) and ($this->configuration['default'][$key] === $val)) unset ($this->configuration['client:'.$this->client][$key]);
      }
    }
    foreach ($this->configuration as $key => $val)
    {
      fwrite($fp, "[$key]\n");
      foreach ($this->configuration[$key] as $k => $v)
      {
        $b = is_bool($v)?'y':'n';
        if ($v == 'true' or $v == 'false' or is_bool ($v))
        {
          $v = ($v == 'true')?'true':'false';
          fwrite($fp, "$k = $v \n");
        }
        else
          fwrite($fp, "$k = '$v'\n");
      }
      fwrite($fp, "\n");
    }
    fclose($fp);
  }
}


?>
