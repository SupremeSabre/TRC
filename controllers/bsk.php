<?php
/**
 * @brief 8sk二开模块
 * @class bsk
 */
class bsk extends IController
{
	public $layout='';
	public function init(){

	}
	
    //主页ajax加载
	function hot_goods(){
		$last    = IFilter::act( IReq::get('last'),'int');
		if($last<56){
			//查询条件
			$where       = 'go.is_del = 0';
			$table_name  = 'goods as go';
			$fields      = 'go.id as goods_id,go.name,go.img,go.sell_price,go.market_price';

			//推荐商品
			$table_name .= ' ,commend_goods as cro ';
			$where      .= ' and cro.goods_id = go.id and cro.commend_id  = 4';
			
			$limit       = '6';
			$order       = 'rand()';
					
			$goodsDB     = new IModel($table_name);
			$data = $goodsDB->query($where,$fields,$order,$limit,null);
			$out=1;
			foreach($data as $key => $item){
				$sayList[] = array( 
					'product' => "<li><a href='".IUrl::creatUrl()."site/products/id/".$item['goods_id']."' title='".$item['name']."'><div class='products_kuang'><img src='".IUrl::creatUrl("/pic/thumb/img/".$item['img']."/w/160/h/160")."'></div><div class='goods_name'>".$item['name']."</div></a><div class='price'><a href='".IUrl::creatUrl()."site/products/id/".$item['goods_id']."' title='".$item['name']."'><span class='price_pro'> ￥".$item['sell_price']."元</span>
					<span class='costprice'>￥".$item['market_price']."元</span></a><a href='javascript:;' onclick='joinCart_list(".$item['goods_id'].");' class='iconfont'>&#xe629;</a></div></li>"
				);
				if($out>5) // 一次性循环6个产品
				break;
				else
				$out++;
			}
			echo JSON::encode($sayList);
		}
	}
	
    //产品详情ajax加载
	function goods_info(){
	    $id    = IFilter::act( IReq::get('id'),'int');
		
		$obj_bank = new IModel('goods');
		$bank_info = $obj_bank->getObj('id='.$id);
		echo $bank_info['content'];
	}
	
	//[用户头像] 头像上传
    function user_ico_upload(){
	    $user_id = $this->user['user_id'];
		
		if($user_id){
			$uploadObj = new PhotoUpload();
			$uploadObj->setIterance(false);
			$photoInfo = $uploadObj->run();
			if(isset($_FILES['photo']['tmp_name']) && $_FILES['photo']['tmp_name']!=''){
				if(isset($photoInfo['photo']['img']) && file_exists($photoInfo['photo']['img'])){
					$files = $photoInfo['photo']['img'];
					echo JSON::encode($files);
				}
			}
		}else{
		    //没登录不允许上张照片
		    $this->redirect('/simple/login');
		}
	}

    //[用户头像] 裁切保存
    function user_ico_save(){
	    $user_id = $this->user['user_id'];
		
		if($user_id){
			$base64 = htmlspecialchars($_POST['str']);
			if (preg_match('/^(data:\s*image\/(\w+);base64,)/',$base64,$result)) {
				$new_file = "./upload/user_photo/".$this->user['user_id'].".jpg";
				if (file_put_contents($new_file,base64_decode(str_replace($result[1],'',$base64)))) {
					
					$user_obj  = new IModel('user');
					$dataArray = array(
						'head_ico' => IUrl::creatUrl().$new_file
					);
					$user_obj->setData($dataArray);
					$where  = 'id = '.$user_id;
					if($user_obj->update($where)){
						echo JSON::encode("success");
					}
				}
			}
		}else{
		    //没登录不允许裁剪头像
		    $this->redirect('/simple/login');
		}
    }

}