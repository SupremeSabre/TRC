<?php

class Test extends IController{
    
    public $layout = 'site';
    function hello() {
        $this->redirect('hello');
    }
}